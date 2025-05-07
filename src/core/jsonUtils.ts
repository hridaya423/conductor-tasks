import logger from './logger.js';

export class JsonUtils {
  
  static extractJsonArray(text: string, fallbackToEmpty: boolean = false): any[] | null {
    if (!text || typeof text !== 'string') {
      logger.debug('JsonUtils.extractJsonArray: Input is empty or not a string');
      return fallbackToEmpty ? [] : null;
    }
    
    logger.debug(`JsonUtils.extractJsonArray: Processing text (${text.length} chars): ${text.substring(0, 100)}...`);
    
    try {
      const trimmedText = text.trim();
      const parsed = JSON.parse(trimmedText);
      if (Array.isArray(parsed)) {
        logger.debug(`JsonUtils.extractJsonArray: Successfully parsed as array with ${parsed.length} items`);
        return parsed;
      } else {
        if (typeof parsed === 'object' && parsed !== null) {
          logger.debug('JsonUtils.extractJsonArray: Parsed as object, wrapping in array');
          return [parsed];
        }
        logger.debug(`JsonUtils.extractJsonArray: Parsed as non-array, non-object type: ${typeof parsed}`);
        return fallbackToEmpty ? [] : null;
      }
    } catch (error) {
      logger.debug(`JsonUtils.extractJsonArray: Direct parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const textWithoutMarkdown = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    
    try {
      const parsed = JSON.parse(textWithoutMarkdown);
      if (Array.isArray(parsed)) {
        logger.debug(`JsonUtils.extractJsonArray: Successfully parsed without markdown as array with ${parsed.length} items`);
        return parsed;
      } else if (typeof parsed === 'object' && parsed !== null) {
        logger.debug('JsonUtils.extractJsonArray: Parsed without markdown as object, wrapping in array');
        return [parsed];
      }
    } catch (error) {
      logger.debug(`JsonUtils.extractJsonArray: Parsing without markdown failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      let jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/s);
      if (jsonMatch && jsonMatch[0]) {
        logger.debug(`JsonUtils.extractJsonArray: Found array pattern, attempting to parse match of length ${jsonMatch[0].length}`);
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          logger.debug(`JsonUtils.extractJsonArray: Successfully parsed array pattern with ${parsed.length} items`);
          return parsed;
        }
      } else {
        logger.debug('JsonUtils.extractJsonArray: No array pattern match found with regex');
      }
    } catch (error) {
      logger.debug(`JsonUtils.extractJsonArray: Array pattern parsing failed: ${error instanceof Error ? error.message : String(error)}`);
      
    }

    try {
      const startIdx = text.indexOf('[');
      const endIdx = text.lastIndexOf(']');
      
      if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
        const jsonCandidate = text.substring(startIdx, endIdx + 1);
        logger.debug(`JsonUtils.extractJsonArray: Found potential JSON array from index ${startIdx} to ${endIdx}, length: ${jsonCandidate.length}`);
        const parsed = JSON.parse(jsonCandidate);
        if (Array.isArray(parsed)) {
          logger.debug(`JsonUtils.extractJsonArray: Successfully parsed bracket-extracted array with ${parsed.length} items`);
          return parsed;
        }
      } else {
        logger.debug(`JsonUtils.extractJsonArray: Could not find valid [ and ] pair. Start index: ${startIdx}, End index: ${endIdx}`);
      }
    } catch (error) {
      logger.debug(`JsonUtils.extractJsonArray: Bracket extraction parsing failed: ${error instanceof Error ? error.message : String(error)}`);
      
    }

    
    try {
      
      let jsonMatch = text.match(/\{\s*"[\s\S]*"\s*:[\s\S]*\}/s);
      if (jsonMatch && jsonMatch[0]) {
        logger.debug(`JsonUtils.extractJsonArray: Found object pattern, attempting to parse match of length ${jsonMatch[0].length}`);
        const parsed = JSON.parse(jsonMatch[0]);
        if (typeof parsed === 'object' && parsed !== null) {
          logger.debug('JsonUtils.extractJsonArray: Successfully parsed object pattern, wrapping in array');
          return [parsed]; 
        }
      } else {
        logger.debug('JsonUtils.extractJsonArray: No object pattern match found with regex');
      }
    } catch (error) {
      logger.debug(`JsonUtils.extractJsonArray: Object pattern parsing failed: ${error instanceof Error ? error.message : String(error)}`);
      
    }

    
    try {
      
      const startMarkers = [
        "===== START LLM RESPONSE =====", 
        "START JSON", 
        "JSON RESPONSE:",
        "JSON_RESPONSE:",
        "JSON START"
      ];
      const endMarkers = [
        "===== END LLM RESPONSE =====", 
        "END JSON", 
        "END OF JSON",
        "JSON END"
      ];
      
      let cleanedText = text;
      
      
      for (const startMarker of startMarkers) {
        const startIdx = text.indexOf(startMarker);
        if (startIdx !== -1) {
          cleanedText = text.substring(startIdx + startMarker.length);
          logger.debug(`JsonUtils.extractJsonArray: Found start marker "${startMarker}" at position ${startIdx}`);
          break;
        }
      }
      
      for (const endMarker of endMarkers) {
        const endIdx = cleanedText.indexOf(endMarker);
        if (endIdx !== -1) {
          cleanedText = cleanedText.substring(0, endIdx);
          logger.debug(`JsonUtils.extractJsonArray: Found end marker "${endMarker}"`);
          break;
        }
      }
      
      if (cleanedText !== text) {
        logger.debug(`JsonUtils.extractJsonArray: Extracted content between markers, length: ${cleanedText.length}`);
        
        
        const trimmed = cleanedText.trim();
        
        
        if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || 
            (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
              logger.debug(`JsonUtils.extractJsonArray: Successfully parsed marker-extracted array with ${parsed.length} items`);
              return parsed;
            } else if (typeof parsed === 'object' && parsed !== null) {
              logger.debug('JsonUtils.extractJsonArray: Successfully parsed marker-extracted object, wrapping in array');
              return [parsed];
            }
          } catch (error) {
            logger.debug(`JsonUtils.extractJsonArray: Marker extraction parsing failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    } catch (error) {
      logger.debug(`JsonUtils.extractJsonArray: Log marker extraction failed: ${error instanceof Error ? error.message : String(error)}`);
      
    }

    
    try {
      
      let cleanText = text
        .replace(/^[\s\S]*?(\[)/m, '[') 
        .replace(/(\])[\s\S]*$/m, ']')  
        .replace(/```json/g, '')        
        .replace(/```/g, '')            
        .replace(/\n/g, ' ')            
        .replace(/,\s*]/g, ']')         
        .replace(/,\s*}/g, '}')         
        .replace(/'/g, '"')             
        .replace(/([{,])\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":'); 
      
      logger.debug(`JsonUtils.extractJsonArray: Attempting aggressive cleaning, cleaned text length: ${cleanText.length}`);
      const parsed = JSON.parse(cleanText);
      if (Array.isArray(parsed)) {
        logger.debug(`JsonUtils.extractJsonArray: Successfully parsed aggressively cleaned array with ${parsed.length} items`);
        return parsed;
      } else if (typeof parsed === 'object' && parsed !== null) {
        logger.debug('JsonUtils.extractJsonArray: Successfully parsed aggressively cleaned object, wrapping in array');
        return [parsed]; 
      }
    } catch (error) {
      logger.debug(`JsonUtils.extractJsonArray: Aggressive cleaning parsing failed: ${error instanceof Error ? error.message : String(error)}`);
      
    }

    
    try {
      
      let extremeCleanText = text
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') 
        .replace(/[^\[\]\{\}",:.\w\s-]/g, ' ')  
        .replace(/\s+/g, ' ')                  
        .trim();
      
      logger.debug(`JsonUtils.extractJsonArray: Attempting extreme cleaning, cleaned text length: ${extremeCleanText.length}`);
      
      
      const objMatch = extremeCleanText.match(/\{[^{}]*"[^{}]*"[^{}]*:[^{}]*("[^{}]*"|[0-9]+)[^{}]*\}/g);
      if (objMatch && objMatch.length > 0) {
        
        const arrayStr = '[' + objMatch.join(',') + ']';
        logger.debug(`JsonUtils.extractJsonArray: Found ${objMatch.length} object patterns, attempting to construct array`);
        const parsed = JSON.parse(arrayStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          logger.debug(`JsonUtils.extractJsonArray: Successfully parsed array from ${parsed.length} extracted objects`);
          return parsed;
        }
      } else {
        logger.debug('JsonUtils.extractJsonArray: No valid object patterns found in extreme cleaning');
      }
    } catch (error) {
      logger.debug(`JsonUtils.extractJsonArray: Extreme cleaning parsing failed: ${error instanceof Error ? error.message : String(error)}`);
      
    }
    
    
    logger.debug(`JsonUtils.extractJsonArray: All extraction attempts failed, returning ${fallbackToEmpty ? 'empty array' : 'null'}`);
    return fallbackToEmpty ? [] : null;
  }

  
  static ensureJsonArray(text: string): any[] {
    const result = this.extractJsonArray(text, true);
    return result || [];
  }
} 