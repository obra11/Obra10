import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

/**
 * SanitizePipe — Strips dangerous HTML/JS patterns from all string fields in request body.
 * No external dependencies — uses regex only.
 *
 * Removes: <script>, <iframe>, <object>, <embed>, <form>, javascript: URLs,
 *          on* event handlers (onclick, onerror, etc.), data: URIs with scripts.
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (metadata.type !== 'body') return value;
    return this.sanitize(value);
  }

  private sanitize(value: any): any {
    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }
    if (value && typeof value === 'object') {
      const sanitized: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = this.sanitize(val);
      }
      return sanitized;
    }
    return value;
  }

  private sanitizeString(input: string): string {
    return input
      // Remove script tags and content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove dangerous tags (iframe, object, embed, form)
      .replace(/<\s*\/?\s*(iframe|object|embed|form|link|meta)\b[^>]*>/gi, '')
      // Remove on* event handlers in any remaining tags
      .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\bon\w+\s*=\s*[^\s>]+/gi, '')
      // Remove javascript: and data: URI schemes
      .replace(/javascript\s*:/gi, '')
      .replace(/data\s*:\s*text\/html/gi, '')
      // Remove style expressions (IE-specific XSS)
      .replace(/expression\s*\(/gi, '')
      .trim();
  }
}
