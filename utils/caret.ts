import { Coordinates } from '../types';

/**
 * We create a hidden div that mirrors the input's styles exactly.
 * We copy the text up to the cursor into the div, add a span,
 * and calculate the span's position.
 */
export const getCaretCoordinates = (element: HTMLInputElement | HTMLTextAreaElement): Coordinates => {
  const div = document.createElement('div');
  const style = window.getComputedStyle(element);

  // Copy all relevant styles to ensure the mirror div matches exactly
  const properties = [
    'direction',
    'boxSizing',
    'width',
    'height',
    'overflowX',
    'overflowY',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'borderStyle',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'fontSize',
    'fontSizeAdjust',
    'lineHeight',
    'fontFamily',
    'textAlign',
    'textTransform',
    'textIndent',
    'textDecoration',
    'letterSpacing',
    'wordSpacing',
    'tabSize',
    'MozTabSize',
  ];

  properties.forEach((prop) => {
    // @ts-ignore
    div.style[prop] = style[prop];
  });

  // Specific styles for the mirror div to make it hidden but functional for measurement
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.top = '0';
  div.style.left = '-9999px';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';

  // Content handling
  const value = element.value;
  const selectionPoint = element.selectionStart || 0;
  
  // Create content up to the caret
  const textContent = value.substring(0, selectionPoint);
  
  div.textContent = textContent;

  // Create the span that represents the caret
  const span = document.createElement('span');
  span.textContent = '.'; // Needs some content to have height
  div.appendChild(span);

  document.body.appendChild(div);

  const spanRect = span.getBoundingClientRect();
  const divRect = div.getBoundingClientRect();
  
  // Calculate relative position within the element
  const relativeTop = span.offsetTop;
  const relativeLeft = span.offsetLeft;

  // Clean up
  document.body.removeChild(div);
  
  // Calculate absolute screen position
  // We need to account for the element's scroll position
  const elementRect = element.getBoundingClientRect();
  
  return {
    top: elementRect.top + relativeTop - element.scrollTop + window.scrollY,
    left: elementRect.left + relativeLeft - element.scrollLeft + window.scrollX,
    height: parseInt(style.lineHeight) || parseInt(style.fontSize) || 20
  };
};