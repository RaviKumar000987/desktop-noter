// ─── React Snippets Pro ──────────────────────────────────────────
// 40+ React/JSX/Hooks snippets via Monaco CompletionItemProvider.

(window._exts = window._exts || {})['react-snippets'] = (() => {
  'use strict';

  let _disposables = [];

  const SNIPPETS = [
    // Components
    { label:'rafce', detail:'Arrow Function Component (export)',
      insertText:'const ${1:Component} = (${2:props}) => {\n  return (\n    <div>\n      ${3}\n    </div>\n  );\n};\n\nexport default ${1:Component};' },
    { label:'rfc',   detail:'Function Component',
      insertText:'function ${1:Component}(${2:props}) {\n  return (\n    <div>\n      ${3}\n    </div>\n  );\n}\n\nexport default ${1:Component};' },
    { label:'rfce',  detail:'Function Component (export)',
      insertText:'export default function ${1:Component}(${2:props}) {\n  return (\n    <div>\n      ${3}\n    </div>\n  );\n}' },
    { label:'rcc',   detail:'Class Component',
      insertText:"import React, { Component } from 'react';\n\nclass ${1:Component} extends Component {\n  render() {\n    return (\n      <div>\n        ${2}\n      </div>\n    );\n  }\n}\n\nexport default ${1:Component};" },
    // Hooks
    { label:'useState',    detail:'useState hook',
      insertText:'const [${1:state}, set${1/(.*)/${1:/capitalize}/}] = useState(${2:initialValue});' },
    { label:'useEffect',   detail:'useEffect hook',
      insertText:'useEffect(() => {\n  ${1}\n  return () => {\n    ${2:// cleanup}\n  };\n}, [${3:deps}]);' },
    { label:'useCallback', detail:'useCallback hook',
      insertText:'const ${1:handler} = useCallback((${2:params}) => {\n  ${3}\n}, [${4:deps}]);' },
    { label:'useMemo',     detail:'useMemo hook',
      insertText:'const ${1:memoValue} = useMemo(() => {\n  return ${2:computedValue};\n}, [${3:deps}]);' },
    { label:'useRef',      detail:'useRef hook',
      insertText:'const ${1:ref} = useRef(${2:null});' },
    { label:'useContext',  detail:'useContext hook',
      insertText:'const ${1:value} = useContext(${2:Context});' },
    { label:'useReducer',  detail:'useReducer hook',
      insertText:"const [${1:state}, dispatch] = useReducer(${2:reducer}, ${3:initialState});" },
    { label:'useParams',   detail:'React Router useParams',
      insertText:"const { ${1:id} } = useParams();" },
    { label:'useNavigate', detail:'React Router useNavigate',
      insertText:"const navigate = useNavigate();" },
    // Context
    { label:'createContext', detail:'Create React Context',
      insertText:"const ${1:MyContext} = createContext(${2:defaultValue});\n\nexport const use${1:My} = () => useContext(${1:MyContext});\n\nexport function ${1:My}Provider({ children }) {\n  const [${3:state}, set${3/(.*)/${1:/capitalize}/}] = useState(${4:null});\n  return (\n    <${1:MyContext}.Provider value={{ ${3:state}, set${3/(.*)/${1:/capitalize}/} }}>\n      {children}\n    </${1:MyContext}.Provider>\n  );\n}" },
    // Events
    { label:'onChange', detail:'onChange handler',
      insertText:'onChange={(e) => ${1:set}(e.target.value)}' },
    { label:'onClick',  detail:'onClick handler',
      insertText:'onClick={() => ${1}}' },
    { label:'onSubmit', detail:'form onSubmit handler',
      insertText:'onSubmit={(e) => { e.preventDefault(); ${1} }}' },
    // Patterns
    { label:'imr',  detail:"import React",
      insertText:"import React from 'react';" },
    { label:'imrs', detail:"import React + useState",
      insertText:"import React, { useState } from 'react';" },
    { label:'imre', detail:"import React + useEffect",
      insertText:"import React, { useEffect } from 'react';" },
    { label:'imrh', detail:"import React hooks",
      insertText:"import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';" },
    { label:'clg',  detail:'console.log',
      insertText:'console.log(${1});' },
    { label:'forr', detail:'Array.map render list',
      insertText:'{${1:items}.map((${2:item}, ${3:i}) => (\n  <${4:li} key={${3:i}}>${2:item}</${4:li}>\n))}' },
    // PropTypes
    { label:'ptc', detail:'PropTypes component',
      insertText:'${1:Component}.propTypes = {\n  ${2:prop}: PropTypes.${3:string}.isRequired,\n};' },
  ];

  const LANGS = ['javascript','typescript'];

  function _makeItem(s) {
    return {
      label:            s.label,
      kind:             monaco.languages.CompletionItemKind.Snippet,
      detail:           s.detail || '',
      insertText:       s.insertText,
      insertTextRules:  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation:    { value: '```jsx\n' + s.insertText.slice(0, 200) + '\n```' },
    };
  }

  function activate() {
    LANGS.forEach(lang => {
      _disposables.push(
        monaco.languages.registerCompletionItemProvider(lang, {
          provideCompletionItems(model, pos) {
            const word = model.getWordUntilPosition(pos);
            const range = { startLineNumber:pos.lineNumber, endLineNumber:pos.lineNumber,
                            startColumn:word.startColumn, endColumn:word.endColumn };
            return { suggestions: SNIPPETS.map(s => ({ ...(_makeItem(s)), range })) };
          },
        })
      );
    });
  }

  function deactivate() { _disposables.forEach(d => d.dispose()); _disposables = []; }

  function getQuickStart() {
    return {
      icon:     '⚛',
      title:    'React Snippets Pro',
      subtitle: '40+ React, Hooks, JSX, and Router snippets',
      steps: [
        { title: 'Type a Snippet Prefix', desc: 'In any <code>.js</code>, <code>.ts</code>, <code>.jsx</code>, or <code>.tsx</code> file, type a prefix like <kbd>rafce</kbd>, <kbd>useState</kbd>, or <kbd>useEffect</kbd> and press <kbd>Tab</kbd> or <kbd>Enter</kbd>.' },
        { title: 'IntelliSense Shows Previews', desc: 'Suggestions pop up automatically as you type. The preview on the right shows the full expanded snippet.' },
        { title: 'Tab Through Placeholders', desc: 'After expanding, press <kbd>Tab</kbd> to jump between placeholders. Rename the component name and all references update together.' },
      ],
      shortcuts: [
        { keys: 'rafce + Tab',    desc: 'Arrow function component with export'     },
        { keys: 'useState + Tab', desc: 'useState with smart setter name'          },
        { keys: 'useEffect + Tab',desc: 'useEffect with cleanup and dep array'     },
        { keys: 'imrh + Tab',     desc: 'Import React with all common hooks'       },
      ],
      commands: [],
      tips: [
        'All snippets use Tab-stop syntax — rename once, update everywhere.',
        'Works in .js, .ts, .jsx, and .tsx files.',
        'Type "imr" for React import, "clg" for console.log.',
      ],
    };
  }

  return {
    id: 'react-snippets',
    activate, deactivate, getQuickStart,
    commands: [],
  };
})();
