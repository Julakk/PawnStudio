// ==============================================
// PawnStudio - Custom Language Definition: PAWN
// ==============================================
// Daftarin bahasa "pawn" ke Monaco biar file .pwn / .inc
// dapet syntax highlighting, bukan plaintext lagi.
//
// Panggil registerPawnLanguage() SEBELUM monaco.editor.create()
// biar language-nya udah dikenal Monaco duluan.

function registerPawnLanguage() {
  monaco.languages.register({ id: "pawn", extensions: [".pwn", ".inc"], aliases: ["Pawn", "pawn"] });

  monaco.languages.setMonarchTokensProvider("pawn", {
    defaultToken: "",
    tokenPostfix: ".pawn",

    keywords: [
      "if", "else", "while", "do", "for", "switch", "case", "default",
      "break", "continue", "return", "goto", "sizeof", "tagof",
      "new", "static", "stock", "public", "native", "forward",
      "const", "state", "enum", "struct",
      "true", "false", "assert"
    ],

    typeKeywords: [
      "Float", "bool", "String", "Text", "Text3D", "Text3D_S",
      "PlayerText", "PlayerText3D", "File", "any"
    ],

    operators: [
      "=", ">", "<", "!", "~", "?", ":",
      "==", "<=", ">=", "!=", "&&", "||",
      "++", "--", "+", "-", "*", "/", "&", "|", "^", "%",
      "<<", ">>", "+=", "-=", "*=", "/=", "&=", "|=", "^=",
      "%=", "<<=", ">>="
    ],

    symbols: /[=><!~?:&|+\-*\/\^%]+/,

    tokenizer: {
      root: [
        // Preprocessor
        [/^\s*#\s*(include|define|undef|if|ifdef|ifndef|else|endif|pragma|line|error|tryinclude)\b.*$/, "keyword.directive"],

        // Identifiers & keywords
        [/[a-zA-Z_]\w*/, {
          cases: {
            "@keywords": "keyword",
            "@typeKeywords": "type",
            "@default": "identifier"
          }
        }],

        // Function calls: identifier diikuti tanda kurung buka
        [/[a-zA-Z_]\w*(?=\s*\()/, "entity.name.function"],

        { include: "@whitespace" },

        // Strings
        [/"([^"\\]|\\.)*$/, "string.invalid"],
        [/"/, { token: "string.quote", bracket: "@open", next: "@string" }],

        // Chars
        [/'[^\\']'/, "string"],
        [/'/, "string.invalid"],

        // Numbers
        [/\d+\.\d+([eE][\-+]?\d+)?/, "number.float"],
        [/0[xX][0-9a-fA-F]+/, "number.hex"],
        [/\d+/, "number"],

        // Delimiters & operators
        [/[{}()\[\]]/, "@brackets"],
        [/[;,.]/, "delimiter"],
        [/@symbols/, {
          cases: {
            "@operators": "operator",
            "@default": ""
          }
        }],
      ],

      whitespace: [
        [/[ \t\r\n]+/, "white"],
        [/\/\*/, "comment", "@comment"],
        [/\/\/.*$/, "comment"],
      ],

      comment: [
        [/[^\/*]+/, "comment"],
        [/\*\//, "comment", "@pop"],
        [/[\/*]/, "comment"],
      ],

      string: [
        [/[^\\"]+/, "string"],
        [/\\./, "string.escape"],
        [/"/, { token: "string.quote", bracket: "@close", next: "@pop" }],
      ],
    },
  });

  // Auto-closing brackets & comment toggling
  monaco.languages.setLanguageConfiguration("pawn", {
    comments: {
      lineComment: "//",
      blockComment: ["/*", "*/"],
    },
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
  });
}
