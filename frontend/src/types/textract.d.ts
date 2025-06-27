declare module 'textract' {
    interface TextractOptions {
        preserveLineBreaks?: boolean;
        preserveOnlyMultipleLineBreaks?: boolean;
        [key: string]: any;
    }

    function fromBufferWithMime(
        mimeType: string,
        buffer: Buffer,
        options: TextractOptions,
        callback: (error: Error | null, text: string) => void
    ): void;

    export = {
        fromBufferWithMime
    };
} 