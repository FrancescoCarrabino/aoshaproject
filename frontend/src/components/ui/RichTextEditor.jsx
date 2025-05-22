// src/components/ui/RichTextEditor.jsx
import React from 'react';
import { useEditor, EditorContent, BubbleMenu, FloatingMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LinkExtension from '@tiptap/extension-link'; // Renamed to avoid conflict
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline'; // Explicitly add Underline

import { Box, Paper, IconButton, ToggleButton, ToggleButtonGroup, Divider, TextField, Button } from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
import CodeIcon from '@mui/icons-material/Code';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import FormatClearIcon from '@mui/icons-material/FormatClear'; // For clearing formats
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import FormatAlignJustifyIcon from '@mui/icons-material/FormatAlignJustify';
import TitleIcon from '@mui/icons-material/Title'; // For headings
import PaletteIcon from '@mui/icons-material/Palette'; // For color
import BorderColorIcon from '@mui/icons-material/BorderColor'; // For highlight


const MenuBar = ({ editor }) => {
  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    if (url === null) return;
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_blank' }).run();
  };

  return (
    <Paper elevation={0} sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', p: 0.5, borderBottom: 1, borderColor: 'divider', gap: 0.5 }}>
      <ToggleButtonGroup size="small">
        <ToggleButton value="bold" title="Bold" selected={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><FormatBoldIcon fontSize="small" /></ToggleButton>
        <ToggleButton value="italic" title="Italic" selected={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><FormatItalicIcon fontSize="small" /></ToggleButton>
        <ToggleButton value="underline" title="Underline" selected={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><FormatUnderlinedIcon fontSize="small" /></ToggleButton>
        <ToggleButton value="strike" title="Strikethrough" selected={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><StrikethroughSIcon fontSize="small" /></ToggleButton>
      </ToggleButtonGroup>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />
      <ToggleButtonGroup size="small">
        <ToggleButton title="Heading 1" selected={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</ToggleButton>
        <ToggleButton title="Heading 2" selected={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToggleButton>
        <ToggleButton title="Heading 3" selected={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToggleButton>
        <ToggleButton title="Paragraph" selected={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()}>P</ToggleButton>
      </ToggleButtonGroup>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />
      <ToggleButtonGroup size="small">
        <ToggleButton title="Bullet List" selected={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><FormatListBulletedIcon fontSize="small" /></ToggleButton>
        <ToggleButton title="Numbered List" selected={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><FormatListNumberedIcon fontSize="small" /></ToggleButton>
      </ToggleButtonGroup>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />
      <ToggleButtonGroup size="small">
        <ToggleButton title="Blockquote" selected={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><FormatQuoteIcon fontSize="small" /></ToggleButton>
        <ToggleButton title="Code Block" selected={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><CodeIcon fontSize="small" /></ToggleButton>
      </ToggleButtonGroup>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />
      <ToggleButtonGroup size="small">
        <ToggleButton title="Link" selected={editor.isActive('link')} onClick={setLink}><LinkIcon fontSize="small" /></ToggleButton>
        <ToggleButton title="Unlink" disabled={!editor.isActive('link')} onClick={() => editor.chain().focus().unsetLink().run()}><LinkOffIcon fontSize="small" /></ToggleButton>
      </ToggleButtonGroup>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />
      <ToggleButtonGroup size="small">
        <ToggleButton title="Align Left" selected={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><FormatAlignLeftIcon fontSize="small" /></ToggleButton>
        <ToggleButton title="Align Center" selected={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><FormatAlignCenterIcon fontSize="small" /></ToggleButton>
        <ToggleButton title="Align Right" selected={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><FormatAlignRightIcon fontSize="small" /></ToggleButton>
      </ToggleButtonGroup>
      {/* Placeholder for Color and Highlight pickers */}
      {/* <input type="color" onChange={event => editor.chain().focus().setColor(event.target.value).run()} value={editor.getAttributes('textStyle').color || '#000000'} title="Text Color"/> */}
      {/* <input type="color" onChange={event => editor.chain().focus().toggleHighlight({ color: event.target.value }).run()} title="Highlight Color"/> */}
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />
      <IconButton title="Clear Format" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} size="small"><FormatClearIcon fontSize="small" /></IconButton>
    </Paper>
  );
};


const RichTextEditor = ({ content, onChange, placeholder, editorStyle }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] }, // Configure heading levels
        // Disable other StarterKit modules if not needed
      }),
      LinkExtension.configure({ // Use the renamed import
        openOnClick: false, // Don't open links in editor
        autolink: true,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' },
      }),
      Placeholder.configure({ placeholder: placeholder || 'Start typing...' }),
      TextAlign.configure({ types: ['heading', 'paragraph', 'listItem'] }),
      TextStyle, // Required for Color
      Color.configure({ types: ['textStyle'] }),
      Highlight.configure({ multicolor: true, types: ['textStyle', 'listItem'] }),
      Underline, // Add Underline extension
    ],
    content: content || '', // Initial content
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML()); // Output HTML
    },
    editorProps: { // Props passed directly to the ProseMirror EditorView
      attributes: { // HTML attributes for the editable element
        // class: 'prose max-w-none focus:outline-none', // Example for Tailwind Prose
        // You can add a specific class for direct CSS targeting if needed
      },
    },
  });

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, display: 'flex', flexDirection: 'column', ...editorStyle }}>
      {editor && <MenuBar editor={editor} />}
      <EditorContent editor={editor} style={{ flexGrow: 1, overflowY: 'auto', padding: '12px 16px', minHeight: '200px' }} /> {/* Added minHeight */}
    </Box>
  );
};

export default RichTextEditor;
