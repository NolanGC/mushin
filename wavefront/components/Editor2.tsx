'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useState, useEffect, } from 'react';
import { Extension } from '@tiptap/core';
import { Mathematics } from '@tiptap-pro/extension-mathematics'
import { posToDOMRect } from '@tiptap/core';
import 'katex/dist/katex.min.css'

const processContent = async (text: string): Promise<string> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(text);
        }, 2000);
    });
};

const WavefrontExtension = Extension.create({
    name: 'wavefront',
    addStorage() {
        return {
            wavefrontYPosition: 0,
            cursorYPosition: 0,
            isProcessing: false,
        };
    },
    addKeyboardShortcuts() {
        return {
            'Shift-Enter': ({ editor }) => {
                const cursorY = editor.storage.wavefront.cursorYPosition;
                const wavefrontY = editor.storage.wavefront.wavefrontYPosition;
                if (!editor.storage.wavefront.isProcessing) {
                    editor.storage.wavefront.isProcessing = true;
                    if (wavefrontY <= cursorY) {
                        editor.storage.wavefront.wavefrontYPosition = editor.storage.wavefront.cursorYPosition;
                    }
                    processContent(editor.getHTML()).then((html) => {
                        editor.storage.wavefront.isProcessing = false;
                    });
                }
                editor.commands.focus(); // to force a re-render
                return true;
            },
        };
    },
    onTransaction({ editor }) {
        const cursorRect = posToDOMRect(editor.view, editor.state.selection.from, editor.state.selection.to);
        const editorRect = editor.view.dom.getBoundingClientRect();
        const newPosition = cursorRect.top - editorRect.top;
        editor.storage.wavefront.cursorYPosition = newPosition;
    
        const lastPos = editor.state.doc.content.size;
        const lastLineRect = posToDOMRect(editor.view, lastPos, lastPos);
        const lastLineY = lastLineRect.top - editorRect.top;
    
        if (editor.storage.wavefront.wavefrontYPosition >= lastLineY) {
            editor.storage.wavefront.wavefrontYPosition = newPosition;
            editor.commands.focus(); // to force a re-render
        }
    }
});


export default function Editor() {
    const [lineHeight, setLineHeight] = useState(21);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                hardBreak: {
                    keepMarks: true,
                },
            }),
            WavefrontExtension,
        ],
        content: '',
        autofocus: true,
    });

    return (
        <div className="w-full max-w-4xl mx-auto relative">
            {editor && (
                // wavefront indicator
                <div
                    className="absolute left-0 w-[1px] bg-gray-300 transition-all duration-200 -translate-x-3"
                    style={{
                        top: `${editor.storage.wavefront.wavefrontYPosition}px`,
                        height: `${lineHeight}px`,
                    }}
                />
            )}
            <div>
                <EditorContent
                    editor={editor}
                    spellCheck="false"
                    className="prose max-w-none min-h-[400px] focus:outline-none [&_*]:outline-none [&>div>p:first-child]:mt-0 font-inter [&_p]:my-0 [&_p]:leading-normal text-[#2F3437]"
                />
            </div>
        </div>
    );
}
