import { useEffect, useRef, useState } from 'react';
import { translations } from '../i18n/translations';
import LanguageContext from './language-context';

const STORAGE_KEY = 'agrione-language';

const getInitialLanguage = () => {
  const savedLanguage = window.localStorage.getItem(STORAGE_KEY);
  return savedLanguage && translations[savedLanguage] ? savedLanguage : 'en';
};

const getTextContent = (node) => {
  const rawText = node.nodeValue ?? '';
  const leadingSpace = rawText.match(/^\s*/)?.[0] ?? '';
  const trailingSpace = rawText.match(/\s*$/)?.[0] ?? '';
  const sourceText = rawText.trim();

  return { leadingSpace, trailingSpace, sourceText };
};

const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(getInitialLanguage);
  const textSources = useRef(new WeakMap());
  const appliedText = useRef(new WeakMap());
  const attributeSources = useRef(new WeakMap());
  const appliedAttributes = useRef(new WeakMap());

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;

    const translateTextNode = (node) => {
      const { leadingSpace, trailingSpace, sourceText } = getTextContent(node);
      if (!sourceText) return;

      const previousApplied = appliedText.current.get(node);
      const source = node.nodeValue === previousApplied
        ? textSources.current.get(node)
        : sourceText;
      textSources.current.set(node, source);

      const translated = translations[language][source] ?? source;
      const nextValue = `${leadingSpace}${translated}${trailingSpace}`;
      if (node.nodeValue !== nextValue) {
        appliedText.current.set(node, nextValue);
        node.nodeValue = nextValue;
      } else {
        appliedText.current.set(node, nextValue);
      }
    };

    const translateAttribute = (element, attribute) => {
      const currentValue = element.getAttribute(attribute);
      if (currentValue === null) return;

      let sources = attributeSources.current.get(element);
      if (!sources) {
        sources = new Map();
        attributeSources.current.set(element, sources);
      }
      let applied = appliedAttributes.current.get(element);
      if (!applied) {
        applied = new Map();
        appliedAttributes.current.set(element, applied);
      }

      const source = currentValue === applied.get(attribute)
        ? sources.get(attribute)
        : currentValue;
      sources.set(attribute, source);
      const translated = translations[language][source] ?? source;
      if (currentValue !== translated) {
        applied.set(attribute, translated);
        element.setAttribute(attribute, translated);
      } else {
        applied.set(attribute, translated);
      }
    };

    const translateElement = (element) => {
      if (element.matches('script, style, code, pre')) return;
      ['placeholder', 'title', 'aria-label'].forEach((attribute) => {
        translateAttribute(element, attribute);
      });
    };

    const translateSubtree = (root) => {
      if (root.nodeType === Node.TEXT_NODE) {
        translateTextNode(root);
        return;
      }
      if (root.nodeType !== Node.ELEMENT_NODE) return;

      translateElement(root);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let textNode = walker.nextNode();
      while (textNode) {
        if (!textNode.parentElement?.closest('script, style, code, pre')) {
          translateTextNode(textNode);
        }
        textNode = walker.nextNode();
      }
      root.querySelectorAll('*').forEach(translateElement);
    };

    translateSubtree(document.body);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'characterData') {
          translateTextNode(mutation.target);
        } else if (mutation.type === 'attributes') {
          translateAttribute(mutation.target, mutation.attributeName);
        } else {
          mutation.addedNodes.forEach(translateSubtree);
        }
      });
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label'],
    });

    return () => observer.disconnect();
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export { LanguageProvider };
