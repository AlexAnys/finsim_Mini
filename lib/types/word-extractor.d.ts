// word-extractor 不自带类型声明。仅声明我们用到的最小 API：
// new WordExtractor().extract(buffer | path) → Promise<Document>，Document.getBody() 取正文文本。
// 该库为纯 JS（依赖 saxes/yauzl，均纯 JS），server-only 使用，见 document-ingestion.service.ts。
declare module "word-extractor" {
  interface WordDocument {
    getBody(): string;
    getFootnotes(): string;
    getEndnotes(): string;
    getHeaders(): string;
    getFooters(): string;
  }

  class WordExtractor {
    extract(source: Buffer | string): Promise<WordDocument>;
  }

  export = WordExtractor;
}
