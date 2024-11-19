'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useState, useEffect, useRef } from 'react';
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import { Extension } from '@tiptap/core';
import { Mathematics } from '@tiptap-pro/extension-mathematics'
import 'katex/dist/katex.min.css'

const DELIMITER = "<<<OUTPUT>>>";
const PROMPT = `You are a helpful assitant that takes in rich text, performs spell checking and grammar correction, and returns the corrected text. Additionally, if the input contains math equations in any form, use latex syntax to render them. Example <p>
        Did you know that $3 * 3 = 9$? Isn't that crazy? Also Pythagoras' theorem is $a^2 + b^2 = c^2$.<br />
        Also the square root of 2 is $\\sqrt{2}$. If you want to know more about $\\LaTeX$ visit <a href="https://katex.org/docs/supported.html" target="_blank">katex.org</a>.
      </p>
      <code>
        <pre>$\\LaTeX$</pre>
      </code>
      <p>
        Do you want go deeper? Here is a list of all supported functions:
      </p><ul>
        <li>$\\sin(x)$</li>
        <li>$\\cos(x)$</li>
        <li>$\\tan(x)$</li>
        <li>$\\log(x)$</li>
        <li>$\\ln(x)$</li>
        <li>$\\sqrt{x}$</li>
        <li>$\\sum_{i=0}^n x_i$</li>
        <li>$\\int_a^b x^2 dx$</li>
        <li>$\\frac{1}{x}$</li>
        <li>$\\binom{n}{k}$</li>
        <li>$\\sqrt[n]{x}$</li>
        <li>$\\left(\\frac{1}{x}\\right)$</li>
        <li>$\\left\\{\\begin{matrix}x&\\text{if }x>0\\\\0&\\text{otherwise}\\end{matrix}\\right.$</li>
      </ul>. DO NOT ADD OR REMOVE NEWLINES. When you render latex remove the original unrendered math. Use Katex syntax, using single $ to enclose and DO NOT ENCLOSE LIKE \(\phi = \frac{1 + \sqrt{5}}{2}\). If the user puts soemthing in <> it is an instruction, you are free to do that thing, potentially adding text. Otherwise, do not add text, simply correct / reformat existing data. For example, if you see <write an example> then do that. If you see things like numbered lists, put them in a nicely formatted list.
Start and end your response with ${DELIMITER} Do NOT output any other separators like \`\`\`.

Input text:`;

// Template function for content processing
const processContent = async (text: string): Promise<string> => {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.NEXT_PUBLIC_OPENROUTER_API_KEY}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Wavefront Editor",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": "openai/chatgpt-4o-latest",
        "messages": [
          {
            "role": "user",
            "content": `${PROMPT}\n${text}`
          }
        ]
      })
    });

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Extract content between delimiters, preserving newlines
    const startDelimiterIndex = content.indexOf(DELIMITER);
    if (startDelimiterIndex === -1) return content; // Fallback if no delimiter
    
    const endDelimiterIndex = content.indexOf(DELIMITER, startDelimiterIndex + DELIMITER.length);
    const startContent = startDelimiterIndex + DELIMITER.length;
    
    // If there's an end delimiter, slice between them, otherwise take everything after start
    const processedContent = endDelimiterIndex !== -1
      ? content.slice(startContent, endDelimiterIndex)
      : content.slice(startContent);
      
    // Don't trim to preserve newlines
    return processedContent;
  } catch (error) {
    console.error('Error calling OpenRouter:', error);
    return text; // Return original text on error
  }
};

const WavefrontExtension = Extension.create({
  name: 'wavefront',
  addStorage() {
    return {
      wavefrontPosition: 0,
      isProcessing: false,
    };
  },
  addKeyboardShortcuts() {
    return {
      'Shift-Enter': ({ editor }) => {
        const { state } = editor;
        const currentLine = state.doc.resolve(state.selection.from).path[1];
        const currentPosition = editor.storage.wavefront.wavefrontPosition;
        
        if (currentLine > currentPosition && !editor.storage.wavefront.isProcessing) {
          // Start processing
          editor.storage.wavefront.isProcessing = true;
          editor.storage.wavefront.wavefrontPosition = currentLine;
          
          // Update visual indicator
          const event = new CustomEvent('wavefront-move', { detail: currentLine });
          window.dispatchEvent(event);
          
          // Get current cursor position
          const cursorPos = state.selection.from;
          
          // Get content before cursor
          const beforeCursor = editor.getHTML();
          
          // Process content before cursor
          processContent(beforeCursor).then((processedContent) => {
            // Get content after cursor from current state
            const afterCursor = editor.state.doc.textBetween(cursorPos, editor.state.doc.content.size);
            
            // Set content and restore cursor
            editor.commands.setContent(processedContent);
            if (afterCursor) {
              editor.commands.insertContent(afterCursor);
            }
            
            // Reset state
            editor.storage.wavefront.isProcessing = false;
            editor.commands.focus();
          }).catch((error) => {
            console.error('Error processing content:', error);
            editor.storage.wavefront.isProcessing = false;
          });
        }
        return true;
      },
    };
  },
});

export default function Editor() {
  const [content, setContent] = useState('');
  const [wavefrontLine, setWavefrontLine] = useState(0);
  const [lineHeight, setLineHeight] = useState(21);
  const [isProcessing, setIsProcessing] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const updateWavefrontPosition = (editor: any) => {
    if (!editor) return;

    // Count total number of block nodes
    let totalLines = 0;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'paragraph' || node.type.name === 'table' || 
          node.type.name === 'bulletList' || node.type.name === 'orderedList') {
        totalLines++;
      }
    });

    // Adjust wavefront if it's beyond the last line
    if (editor.storage.wavefront.wavefrontPosition > totalLines - 1) {
      editor.storage.wavefront.wavefrontPosition = Math.max(0, totalLines - 1);
      setWavefrontLine(editor.storage.wavefront.wavefrontPosition);
    }

    // Reset if document is empty
    if (editor.state.doc.textContent.trim() === '') {
      editor.storage.wavefront.wavefrontPosition = 0;
      setWavefrontLine(0);
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        hardBreak: {
          keepMarks: true,
        },
      }),
      WavefrontExtension,
      Mathematics,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: '',
    onUpdate: ({ editor }) => {
      setContent(editor.getHTML());
      setIsProcessing(editor.storage.wavefront.isProcessing);
      updateWavefrontPosition(editor);
    },
  });

  useEffect(() => {
    const handleWavefrontMove = (event: any) => {
      setWavefrontLine(event.detail);
    };
    window.addEventListener('wavefront-move', handleWavefrontMove);
    return () => window.removeEventListener('wavefront-move', handleWavefrontMove);
  }, []);

  useEffect(() => {
    if (editor && editorRef.current) {
      const paragraphElement = editorRef.current.querySelector('p');
      if (paragraphElement) {
        const computedStyle = window.getComputedStyle(paragraphElement);
        const actualLineHeight = parseFloat(computedStyle.lineHeight);
        setLineHeight(actualLineHeight);
      }
    }
  }, [editor]);

  return (
    <div className="w-full max-w-4xl mx-auto relative">
      {editor && (
        <div 
          className="absolute left-0 w-[1px] bg-gray-300 transition-all duration-200 -translate-x-3"
          style={{ 
            top: `${wavefrontLine * lineHeight + 16}px`,
            height: `${lineHeight}px`,
          }}
        />
      )}
      <div ref={editorRef}>
        <EditorContent 
          editor={editor} 
          spellCheck="false"
          className="prose max-w-none p-4 border rounded-lg min-h-[200px] focus:outline-none [&_*]:outline-none [&_*]:spellcheck-false [&>div>*:first-child]:mt-0 [&>div>p:first-child]:mt-0 font-inter [&_*]:-webkit-spellcheck-false [&_p]:my-0 [&_p]:leading-normal relative text-[#2F3437]"
        />
      </div>
    </div>
  );
}
