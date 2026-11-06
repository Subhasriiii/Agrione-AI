import { languages } from '../i18n/translations';
import useLanguage from '../context/useLanguage';

const LanguageSelector = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <label className="language-selector">
      <select
        aria-label="Language"
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        style={{
          color: 'var(--text-primary)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '0.5rem 0.65rem',
          fontSize: '0.85rem',
          cursor: 'pointer',
        }}
      >
        {languages.map(({ code, name }) => (
          <option key={code} value={code}>{name}</option>
        ))}
      </select>
    </label>
  );
};

export default LanguageSelector;
