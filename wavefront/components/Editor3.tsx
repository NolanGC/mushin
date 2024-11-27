'use client';

import { useEditor, EditorContent, Extension, Node } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { posToDOMRect } from '@tiptap/core';

const LoadingNode = Node.create({
    name: 'loading',
    group: 'block',
    atom: true,
    addAttributes: () => ({
        height: { default: 21 },
        originalText: { default: '' }
    }),
    parseHTML: () => [{ tag: 'div.loading-block' }],
    renderHTML: ({ HTMLAttributes }) => ['div', {
        class: 'bg-gray-100 animate-pulse rounded my-0 py-0',
        style: `height: ${HTMLAttributes.height}px; min-width: 50px;`
    }]
});

const WavefrontExtension = Extension.create({
    name: 'wavefront',
    addStorage() {
        return {
            wavefrontY: 0,
            prevWavefrontY: 0,
            targetY: 0,
            isProcessing: false
        };
    },
    addKeyboardShortcuts() {
        return {
            'Shift-Enter': ({ editor }) => {
                if (editor.storage.wavefront.isProcessing) return true;

                const doc = editor.state.doc;
                const cursorPos = editor.state.selection.from;
                const editorRect = editor.view.dom.getBoundingClientRect();
                const wavefrontY = editor.storage.wavefront.wavefrontY;
                
                let low = 0;
                let high = doc.content.size;
                let wavefrontPos = 0;
                
                while (low <= high) {
                    const mid = Math.floor((low + high) / 2);
                    const y = editor.view.coordsAtPos(mid).top - editorRect.top;
                    
                    if (Math.abs(y - wavefrontY) < 5) {
                        wavefrontPos = mid;
                        break;
                    }
                    
                    if (y < wavefrontY) {
                        low = mid + 1;
                    } else {
                        high = mid - 1;
                    }
                }

                if (wavefrontPos >= cursorPos) return true;

                const selectedText = editor.state.doc.textBetween(wavefrontPos, cursorPos, "\n");
                if (selectedText.length === 0) return true;

                const startCoords = editor.view.coordsAtPos(wavefrontPos);
                const endCoords = editor.view.coordsAtPos(cursorPos);
                const height = Math.max(endCoords.top - startCoords.top, 21);
                const finalY = endCoords.bottom - editor.view.dom.getBoundingClientRect().top;

                editor.storage.wavefront.targetY = finalY;
                editor.storage.wavefront.prevWavefrontY = editor.storage.wavefront.wavefrontY;
                editor.storage.wavefront.isProcessing = true;

                const tr = editor.state.tr;
                tr.delete(wavefrontPos, cursorPos);

                const loadingNode = editor.schema.nodes.loading.create({ height, originalText: selectedText });
                const insertPos = tr.mapping.map(wavefrontPos);
                tr.insert(insertPos, loadingNode)
                  .insert(insertPos + loadingNode.nodeSize, editor.schema.nodes.paragraph.create())
                  .setSelection(editor.state.selection.constructor.near(
                      tr.doc.resolve(insertPos + loadingNode.nodeSize + 1)
                  ));

                editor.view.dispatch(tr);

                processContent(selectedText).then(processedHtml => {
                    const loadingPos = editor.state.doc.descendants((node, pos) => {
                        if (node.type.name === 'loading') return pos;
                    });

                    if (loadingPos !== undefined) {
                        const tr = editor.state.tr;
                        const paragraph = editor.schema.nodes.paragraph.create(
                            {},
                            editor.schema.text(processedHtml)
                        );

                        const insertPos = tr.mapping.map(loadingPos);
                        tr.delete(loadingPos, loadingPos + 1)
                          .insert(insertPos, paragraph)
                          .setSelection(editor.state.selection.constructor.create(
                              tr.doc,
                              tr.mapping.map(editor.state.selection.from),
                              tr.mapping.map(editor.state.selection.to)
                          ));

                        editor.storage.wavefront.wavefrontY = editor.storage.wavefront.targetY;
                        editor.view.dispatch(tr);
                    }

                    editor.storage.wavefront.isProcessing = false;
                });

                return true;
            }
        };
    }
});

const processContent = async (text: string): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return text.toUpperCase();
};

export default function Editor() {
    const editor = useEditor({
        extensions: [StarterKit, LoadingNode, WavefrontExtension],
        content: '',
        autofocus: true
    });

    return (
        <div className="w-full max-w-4xl mx-auto relative">
            {editor && (
                <div
                    className="absolute left-0 w-[1px] bg-gray-300 transition-all duration-200 -translate-x-3"
                    style={{
                        top: `${editor.storage.wavefront.wavefrontY}px`,
                        height: '21px'
                    }}
                />
            )}
            <EditorContent
                editor={editor}
                className="prose max-w-none min-h-[400px] focus:outline-none [&_*]:outline-none [&>div>p:first-child]:mt-0 font-inter [&_p]:my-0 [&_p]:leading-normal text-[#2F3437]"
            />
        </div>
    );
}
