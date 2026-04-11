#!/usr/bin/env node

/**
 * Converts a Markdown file into a DDoc JSON file.
 *
 * Usage:
 *   node scripts/md-to-ddoc.cjs input.md [output.ddoc.json]
 *
 * If output is omitted, writes to input.ddoc.json (same name, .ddoc.json extension).
 * Run from the project root so node_modules are resolved.
 */

const fs = require('fs');
const path = require('path');

// --- DOM polyfill (tiptap's generateJSON requires window/document) -------

const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.Node = dom.window.Node;
global.HTMLElement = dom.window.HTMLElement;

// --- argument parsing ---------------------------------------------------

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node scripts/md-to-ddoc.cjs <input.md> [output.ddoc.json]');
  process.exit(args.length === 0 ? 1 : 0);
}

const inputPath = path.resolve(args[0]);
const outputPath = args[1]
  ? path.resolve(args[1])
  : inputPath.replace(/\.md$/i, '.ddoc.json');

if (!fs.existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`);
  process.exit(1);
}

// --- dependencies -------------------------------------------------------

const MarkdownIt = require('markdown-it');
const markdownItFootnote = require('markdown-it-footnote');
const { generateJSON } = require('@tiptap/core');
const StarterKit = require('@tiptap/starter-kit').default || require('@tiptap/starter-kit').StarterKit;
const { TaskList, TaskItem, BulletList, ListItem } = require('@tiptap/extension-list');
const Highlight = require('@tiptap/extension-highlight').default || require('@tiptap/extension-highlight').Highlight;
const { TextStyle } = require('@tiptap/extension-text-style');
const { Table, TableRow, TableCell, TableHeader } = require('@tiptap/extension-table');
const Subscript = require('@tiptap/extension-subscript').default || require('@tiptap/extension-subscript').Subscript;
const Superscript = require('@tiptap/extension-superscript').default || require('@tiptap/extension-superscript').Superscript;

// --- markdown-it setup --------------------------------------------------

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
}).use(markdownItFootnote);

// --- tiptap extensions for generateJSON ---------------------------------

const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4, 5, 6] },
    codeBlock: {},
    blockquote: {},
    horizontalRule: {},
    orderedList: {},
    bulletList: false,
    listItem: false,
  }),
  BulletList,
  ListItem,
  TaskList,
  TaskItem.configure({ nested: true }),
  Highlight.configure({ multicolor: true }),
  TextStyle,
  Table.configure({ resizable: false }),
  TableRow,
  TableCell,
  TableHeader,
  Subscript,
  Superscript,
];

// --- HTML post-processing -----------------------------------------------

/**
 * Convert markdown-it checkbox list output into TipTap-compatible task list HTML.
 *
 * markdown-it renders `- [ ] text` as:
 *   <ul>\n<li>[ ] text</li>\n</ul>
 *
 * TipTap expects:
 *   <ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>text</p></li></ul>
 */
function convertTaskListHtml(html) {
  return html.replace(
    /<ul>\n([\s\S]*?)<\/ul>/g,
    (ulMatch, ulContent) => {
      // Check if this list contains any checkbox items: [ ] or [x] or [X]
      if (!/\[([ xX])\]/.test(ulContent)) {
        return ulMatch;
      }

      // Convert each <li> with a checkbox pattern
      const convertedItems = ulContent.replace(
        /<li>([\s\S]*?)<\/li>/g,
        (_liMatch, liContent) => {
          const match = liContent.match(/^\s*\[([ xX])\]\s*([\s\S]*)$/);
          if (match) {
            const isChecked = match[1].toLowerCase() === 'x';
            const text = match[2].trim();
            return `<li data-type="taskItem" data-checked="${isChecked}"><p>${text}</p></li>`;
          }
          return `<li>${liContent}</li>`;
        }
      );

      return `<ul data-type="taskList">\n${convertedItems}</ul>`;
    }
  );
}

// --- conversion ---------------------------------------------------------

/**
 * Wrap each top-level node inside a dBlock, matching the DDoc document schema:
 *   doc -> dBlock+ -> (block)
 */
function wrapInDBlocks(tiptapJson) {
  const content = (tiptapJson.content || []).map((node) => ({
    type: 'dBlock',
    content: [node],
  }));

  return {
    type: 'doc',
    content,
  };
}

/**
 * Remove empty dBlock nodes (e.g. from stray whitespace in markdown).
 */
function removeEmptyDBlocks(doc) {
  return {
    ...doc,
    content: doc.content.filter((dblock) => {
      const inner = dblock.content && dblock.content[0];
      if (!inner) return false;
      // Keep nodes that have content or are self-closing (like horizontalRule)
      if (inner.content && inner.content.length > 0) return true;
      if (['horizontalRule', 'hardBreak'].includes(inner.type)) return true;
      // Drop empty paragraphs (from whitespace between blocks)
      if (inner.type === 'paragraph' && !inner.content) return false;
      return true;
    }),
  };
}

// Read markdown
const markdown = fs.readFileSync(inputPath, 'utf-8');

// MD -> HTML
let html = md.render(markdown);

// Fix task list HTML for TipTap
html = convertTaskListHtml(html);

// HTML -> TipTap JSON
const tiptapJson = generateJSON(html, extensions);

// Wrap in dBlock nodes to match DDoc schema
let ddocContent = wrapInDBlocks(tiptapJson);

// Clean up empty blocks
ddocContent = removeEmptyDBlocks(ddocContent);

// Build DocumentData envelope
const documentData = {
  content: ddocContent,
  comments: [],
};

// Write output
fs.writeFileSync(outputPath, JSON.stringify(documentData, null, 2), 'utf-8');
console.log(`Converted: ${inputPath} -> ${outputPath}`);
