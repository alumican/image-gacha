/**
 * Parse and process gacha notation in prompts
 * Supports: {{AAA,BBB,CCC}}(2)
 * Also supports multi-line format:
 * {{
 *   AAA,
 *   BBB,
 *   CCC
 * }}(2)
 * Supports custom separator: {{AAA,BBB}}(2, ", ")
 * Supports escaping special characters with backslash:
 * - In items: \{, \}, \,, \\, \n, \t, \r
 * - In separator: \(, \), \', \", \\, \n, \t, \r
 */

/**
 * Unescape special characters in a string
 * Supports:
 * - Standard escape sequences: \\, \n, \t, \r
 * - Custom escapes: characters specified in allowedEscapes
 * @param str - String with escaped characters
 * @param allowedEscapes - Array of characters that can be escaped (e.g., ['{', '}', ','])
 * @returns String with escape sequences replaced
 */
function unescapeString(str: string, allowedEscapes: string[]): string {
  let result = '';
  let i = 0;
  while (i < str.length) {
    if (str[i] === '\\' && i + 1 < str.length) {
      const nextChar = str[i + 1];
      
      // Standard escape sequences
      if (nextChar === '\\') {
        // Escaped backslash: \\ -> \
        result += '\\';
        i += 2;
      } else if (nextChar === 'n') {
        // Escaped newline: \n -> actual newline
        result += '\n';
        i += 2;
      } else if (nextChar === 't') {
        // Escaped tab: \t -> actual tab
        result += '\t';
        i += 2;
      } else if (nextChar === 'r') {
        // Escaped carriage return: \r -> actual carriage return
        result += '\r';
        i += 2;
      } else if (allowedEscapes.includes(nextChar)) {
        // Custom escape sequence (e.g., \{, \}, \,)
        result += nextChar;
        i += 2;
      } else {
        // Invalid escape, keep backslash as-is
        result += str[i];
        i += 1;
      }
    } else {
      result += str[i];
      i += 1;
    }
  }
  return result;
}

/**
 * Parse gacha notation and replace with randomly selected items
 * @param prompt - Original prompt string
 * @returns Processed prompt with gacha notation replaced
 */
export function parseGachaPrompt(prompt: string): string {
  // Match {{...}}(N) or {{...}}(N, "separator") pattern
  // We need to carefully parse to handle escaped characters
  const gachaPattern = /\{\{((?:[^{}]|\\\{|\\\})*?)\}\}\((\d+)(?:,\s*['"]((?:[^'"]|\\'|\\")*?)['"])?\)/g;

  return prompt.replace(gachaPattern, (match, content, countStr, separator) => {
    const count = parseInt(countStr, 10);
    
    // Unescape separator first (allow (, ), ', ", and standard escapes)
    const joinSeparator = separator !== undefined 
      ? unescapeString(separator, ['(', ')', "'", '"'])
      : ' ';
    
    // Split by comma, but respect escaped commas
    const items: string[] = [];
    let currentItem = '';
    let i = 0;
    
    while (i < content.length) {
      if (content[i] === '\\' && i + 1 < content.length) {
        const nextChar = content[i + 1];
        if (nextChar === ',' || nextChar === '{' || nextChar === '}') {
          // Escaped comma, brace - add to current item
          currentItem += nextChar;
          i += 2;
        } else {
          // Other escape sequence
          currentItem += content[i];
          i += 1;
        }
      } else if (content[i] === ',') {
        // Unescaped comma - split here
        items.push(currentItem);
        currentItem = '';
        i += 1;
      } else {
        currentItem += content[i];
        i += 1;
      }
    }
    
    // Add the last item
    if (currentItem.length > 0) {
      items.push(currentItem);
    }
    
    // Process items: trim whitespace and unescape braces
    const processedItems = items
      .map((item: string) => {
        // Trim leading/trailing whitespace, tabs, and newlines
        // But preserve internal newlines within the item
        const trimmed = item.replace(/^[\s\t\n\r]+|[\s\t\n\r]+$/g, '');
        // Unescape braces and commas in the item
        return unescapeString(trimmed, ['{', '}', ',']);
      })
      .filter((item: string) => item.length > 0); // Remove empty items

    if (processedItems.length === 0) {
      return match; // Return original if no valid items
    }

    // Select random items
    const selected = selectRandomItems(processedItems, Math.min(count, processedItems.length));
    
    // Join selected items with specified separator (default: space)
    return selected.join(joinSeparator);
  });
}

/**
 * Select N random items from an array without duplicates
 * @param items - Array of items to select from
 * @param count - Number of items to select
 * @returns Array of selected items
 */
function selectRandomItems<T>(items: T[], count: number): T[] {
  if (count >= items.length) {
    // Shuffle and return all items if count >= items.length
    return shuffleArray([...items]);
  }

  const shuffled = shuffleArray([...items]);
  return shuffled.slice(0, count);
}

/**
 * Shuffle array using Fisher-Yates algorithm
 * @param array - Array to shuffle
 * @returns Shuffled array (new array, original not modified)
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Preview gacha notation (for UI display)
 * Shows what the gacha notation would expand to
 * @param prompt - Prompt with gacha notation
 * @returns Preview string with gacha notation expanded (using first selection for preview)
 */
export function previewGachaPrompt(prompt: string): string {
  // Use the same pattern as parseGachaPrompt
  const gachaPattern = /\{\{((?:[^{}]|\\\{|\\\})*?)\}\}\((\d+)(?:,\s*['"]((?:[^'"]|\\'|\\")*?)['"])?\)/g;

  return prompt.replace(gachaPattern, (match, content, countStr, separator) => {
    const count = parseInt(countStr, 10);
    
    // Unescape separator first (allow (, ), ', ", and standard escapes)
    const joinSeparator = separator !== undefined 
      ? unescapeString(separator, ['(', ')', "'", '"'])
      : ' ';
    
    // Split by comma, but respect escaped commas (same logic as parseGachaPrompt)
    const items: string[] = [];
    let currentItem = '';
    let i = 0;
    
    while (i < content.length) {
      if (content[i] === '\\' && i + 1 < content.length) {
        const nextChar = content[i + 1];
        if (nextChar === ',' || nextChar === '{' || nextChar === '}') {
          currentItem += nextChar;
          i += 2;
        } else if (nextChar === '\\' || nextChar === 'n' || nextChar === 't' || nextChar === 'r') {
          // Standard escape sequences - add both characters, will be processed later
          currentItem += content[i] + nextChar;
          i += 2;
        } else {
          currentItem += content[i];
          i += 1;
        }
      } else if (content[i] === ',') {
        items.push(currentItem);
        currentItem = '';
        i += 1;
      } else {
        currentItem += content[i];
        i += 1;
      }
    }
    
    if (currentItem.length > 0) {
      items.push(currentItem);
    }
    
    // Process items: trim whitespace and unescape braces
    const processedItems = items
      .map((item: string) => {
        const trimmed = item.replace(/^[\s\t\n\r]+|[\s\t\n\r]+$/g, '');
        return unescapeString(trimmed, ['{', '}', ',']);
      })
      .filter((item: string) => item.length > 0);

    if (processedItems.length === 0) {
      return match;
    }

    // For preview, show first N items (not random)
    const selected = processedItems.slice(0, Math.min(count, processedItems.length));
    return selected.join(joinSeparator);
  });
}

