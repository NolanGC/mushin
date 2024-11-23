'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useState, useEffect } from 'react';
import { Extension, Node, posToDOMRect } from '@tiptap/core';
import { Mathematics } from '@tiptap-pro/extension-mathematics';
import 'katex/dist/katex.min.css';

const processContent = async (text: string): Promise<string> => {
    console.log('Processing content:', text);
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(text);
        }, 2000);
    });
};

const LoadingNode = Node.create({
    name: 'loading',
    group: 'block',
    atom: true,
    draggable: false,
    selectable: false,

    addAttributes() {
        return {
            height: { default: 21 },
            originalText: { default: '' },
            promise: { default: null, rendered: false }
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="loading"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', { 
            'data-type': 'loading',
            class: 'bg-gray-100 animate-pulse rounded my-0 py-0',
            style: `height: ${HTMLAttributes.height}px; min-width: 50px;`
        }];
    },
});

const WavefrontExtension = Extension.create({
    name: 'wavefront',

    addStorage() {
        return {
            wavefrontYPosition: 0,
            prevWavefrontYPosition: 0,
            cursorYPosition: 0,
            isProcessing: false
        };
    },

    addKeyboardShortcuts() {
        return {
            'Shift-Enter': ({ editor }) => {
                console.log('Shift-Enter pressed');
                if (editor.storage.wavefront.isProcessing) return true;

                const doc = editor.state.doc;
                const cursorPos = editor.state.selection.from;
                
                // Find wavefront position
                let wavefrontPos = 0;
                const wavefrontY = editor.storage.wavefront.wavefrontYPosition;
                
                for (let i = 0; i < doc.content.size; i++) {
                    const coords = editor.view.coordsAtPos(i);
                    const y = coords.top - editor.view.dom.getBoundingClientRect().top;
                    if (Math.abs(y - wavefrontY) < 5) {
                        wavefrontPos = i;
                        break;
                    }
                }

                if (wavefrontPos >= cursorPos) return true;
                
                // Get the text and its dimensions
                const selectedText = editor.state.doc.textBetween(
                    wavefrontPos, 
                    cursorPos,
                    "\n",
                    "\n"
                ).trim();

                // Skip if text is empty or only whitespace
                if (!selectedText) {
                    return true;
                }
                
                const startCoords = editor.view.coordsAtPos(wavefrontPos);
                const endCoords = editor.view.coordsAtPos(cursorPos);
                const height = Math.max(endCoords.top - startCoords.top, 21);

                // Create the promise that will resolve to the processed text
                const textPromise = processContent(selectedText);
                
                // Update wavefront position
                editor.storage.wavefront.prevWavefrontYPosition = editor.storage.wavefront.wavefrontYPosition;
                editor.storage.wavefront.wavefrontYPosition = editor.storage.wavefront.cursorYPosition;
                editor.storage.wavefront.isProcessing = true;

                // Replace content with loading node
                const tr = editor.state.tr;
                
                // Store current selection
                const currentSelection = editor.state.selection;
                
                tr.delete(wavefrontPos, cursorPos);
                tr.insert(wavefrontPos, editor.schema.nodes.loading.create({
                    height,
                    originalText: selectedText
                }));
                
                // Restore selection
                tr.setSelection(currentSelection);
                
                // Update wavefront position to be at the cursor
                const editorRect = editor.view.dom.getBoundingClientRect();
                const cursorRect = posToDOMRect(editor.view, cursorPos, cursorPos);
                const newY = cursorRect.top - editorRect.top;
                
                editor.storage.wavefront.prevWavefrontYPosition = editor.storage.wavefront.wavefrontYPosition;
                editor.storage.wavefront.wavefrontYPosition = newY;
                editor.storage.wavefront.cursorYPosition = newY;
                
                editor.view.dispatch(tr);

                // Handle the promise resolution
                textPromise.then(processedHtml => {
                    // Find the loading node in the current document state
                    let loadingNodePos = -1;
                    editor.state.doc.descendants((node, pos) => {
                        if (node.type.name === 'loading') {
                            loadingNodePos = pos;
                            return false;
                        }
                    });

                    if (loadingNodePos !== -1) {
                        const tr = editor.state.tr;
                        
                        // Replace loading node with processed text
                        tr.delete(loadingNodePos, loadingNodePos + 1)
                          .insert(
                            loadingNodePos,
                            editor.schema.nodes.paragraph.create(
                              {},
                              editor.schema.text(processedHtml)
                            )
                          );
                        
                        editor.view.dispatch(tr);
                    }

                    editor.storage.wavefront.isProcessing = false;
                });

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
    // const [isVisible, setIsVisible] = useState(false);
    // const [shouldRender, setShouldRender] = useState(false);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                hardBreak: {
                    keepMarks: true,
                },
            }),
            LoadingNode,
            WavefrontExtension,
        ],
        content: '',
        autofocus: true,
    });

    // useEffect(() => {
    //     if (editor?.storage.wavefront.isProcessing) {
    //         setIsVisible(true);
    //         setShouldRender(true);
    //     } else {
    //         setIsVisible(false);
    //         // Wait for fade-out animation to complete before removing from DOM
    //         setTimeout(() => setShouldRender(false), 300);
    //     }
    // }, [editor?.storage.wavefront.isProcessing]);

    return (
        <div className="w-full max-w-4xl mx-auto relative">
            {editor && (
                <>
                    {/* Processing place */}
                    {/* {shouldRender && (
                        <>
                            <div
                                className="absolute left-0 right-0 bg-white z-10 pointer-events-none select-none"
                                style={{
                                    top: `${editor.storage.wavefront.prevWavefrontYPosition}px`,
                                    height: `${editor.storage.wavefront.wavefrontYPosition - editor.storage.wavefront.prevWavefrontYPosition}px`,
                                }}
                            />
                            <div
                                className={`absolute left-0 right-0 bg-gray-100 z-20 animate-pulse rounded-lg pointer-events-none select-none ${isVisible ? 'fade-in' : 'fade-out'}`}
                                style={{
                                    top: `${editor.storage.wavefront.prevWavefrontYPosition}px`,
                                    height: `${editor.storage.wavefront.wavefrontYPosition - editor.storage.wavefront.prevWavefrontYPosition}px`,
                                }}
                            />
                        </>
                    )} */}
                    {/* wavefront indicator */}
                    <div
                        className="absolute left-0 w-[1px] bg-gray-300 transition-all duration-200 -translate-x-3"
                        style={{
                            top: `${editor.storage.wavefront.wavefrontYPosition}px`,
                            height: `${lineHeight}px`,
                        }}
                    />
                </>
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
