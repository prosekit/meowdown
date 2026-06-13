import { describe, expect, it } from 'vitest'

import { codeBlockLanguages } from './code-block-languages.ts'

describe('codeBlockLanguages', () => {
  it('lists the supported languages as `value → label` pairs', () => {
    expect(codeBlockLanguages).toMatchInlineSnapshot(`
      [
        {
          "label": "APL",
          "value": "apl",
        },
        {
          "label": "ASN.1",
          "value": "asn.1",
        },
        {
          "label": "Asterisk",
          "value": "asterisk",
        },
        {
          "label": "Brainfuck",
          "value": "brainfuck",
        },
        {
          "label": "C",
          "value": "c",
        },
        {
          "label": "C#",
          "value": "c#",
        },
        {
          "label": "C++",
          "value": "c++",
        },
        {
          "label": "Clojure",
          "value": "clojure",
        },
        {
          "label": "ClojureScript",
          "value": "clojurescript",
        },
        {
          "label": "Closure Stylesheets (GSS)",
          "value": "closure stylesheets (gss)",
        },
        {
          "label": "CMake",
          "value": "cmake",
        },
        {
          "label": "Cobol",
          "value": "cobol",
        },
        {
          "label": "CoffeeScript",
          "value": "coffeescript",
        },
        {
          "label": "Common Lisp",
          "value": "common lisp",
        },
        {
          "label": "CQL",
          "value": "cql",
        },
        {
          "label": "Crystal",
          "value": "crystal",
        },
        {
          "label": "CSS",
          "value": "css",
        },
        {
          "label": "Cypher",
          "value": "cypher",
        },
        {
          "label": "Cython",
          "value": "cython",
        },
        {
          "label": "D",
          "value": "d",
        },
        {
          "label": "Dart",
          "value": "dart",
        },
        {
          "label": "diff",
          "value": "diff",
        },
        {
          "label": "Dockerfile",
          "value": "dockerfile",
        },
        {
          "label": "DTD",
          "value": "dtd",
        },
        {
          "label": "Dylan",
          "value": "dylan",
        },
        {
          "label": "EBNF",
          "value": "ebnf",
        },
        {
          "label": "ECL",
          "value": "ecl",
        },
        {
          "label": "edn",
          "value": "edn",
        },
        {
          "label": "Eiffel",
          "value": "eiffel",
        },
        {
          "label": "Elm",
          "value": "elm",
        },
        {
          "label": "Erlang",
          "value": "erlang",
        },
        {
          "label": "Esper",
          "value": "esper",
        },
        {
          "label": "F#",
          "value": "f#",
        },
        {
          "label": "Factor",
          "value": "factor",
        },
        {
          "label": "FCL",
          "value": "fcl",
        },
        {
          "label": "Forth",
          "value": "forth",
        },
        {
          "label": "Fortran",
          "value": "fortran",
        },
        {
          "label": "Gas",
          "value": "gas",
        },
        {
          "label": "Gherkin",
          "value": "gherkin",
        },
        {
          "label": "Go",
          "value": "go",
        },
        {
          "label": "Groovy",
          "value": "groovy",
        },
        {
          "label": "Haskell",
          "value": "haskell",
        },
        {
          "label": "Haxe",
          "value": "haxe",
        },
        {
          "label": "HTML",
          "value": "html",
        },
        {
          "label": "HTTP",
          "value": "http",
        },
        {
          "label": "HXML",
          "value": "hxml",
        },
        {
          "label": "IDL",
          "value": "idl",
        },
        {
          "label": "Java",
          "value": "java",
        },
        {
          "label": "JavaScript",
          "value": "javascript",
        },
        {
          "label": "Jinja",
          "value": "jinja",
        },
        {
          "label": "JSON",
          "value": "json",
        },
        {
          "label": "JSON-LD",
          "value": "json-ld",
        },
        {
          "label": "JSX",
          "value": "jsx",
        },
        {
          "label": "Julia",
          "value": "julia",
        },
        {
          "label": "Kotlin",
          "value": "kotlin",
        },
        {
          "label": "LaTeX",
          "value": "latex",
        },
        {
          "label": "LESS",
          "value": "less",
        },
        {
          "label": "Liquid",
          "value": "liquid",
        },
        {
          "label": "LiveScript",
          "value": "livescript",
        },
        {
          "label": "Lua",
          "value": "lua",
        },
        {
          "label": "MariaDB SQL",
          "value": "mariadb sql",
        },
        {
          "label": "Markdown",
          "value": "markdown",
        },
        {
          "label": "Mathematica",
          "value": "mathematica",
        },
        {
          "label": "Mbox",
          "value": "mbox",
        },
        {
          "label": "mIRC",
          "value": "mirc",
        },
        {
          "label": "Modelica",
          "value": "modelica",
        },
        {
          "label": "MS SQL",
          "value": "ms sql",
        },
        {
          "label": "MUMPS",
          "value": "mumps",
        },
        {
          "label": "MySQL",
          "value": "mysql",
        },
        {
          "label": "Nginx",
          "value": "nginx",
        },
        {
          "label": "NSIS",
          "value": "nsis",
        },
        {
          "label": "NTriples",
          "value": "ntriples",
        },
        {
          "label": "Objective-C",
          "value": "objective-c",
        },
        {
          "label": "Objective-C++",
          "value": "objective-c++",
        },
        {
          "label": "OCaml",
          "value": "ocaml",
        },
        {
          "label": "Octave",
          "value": "octave",
        },
        {
          "label": "Oz",
          "value": "oz",
        },
        {
          "label": "Pascal",
          "value": "pascal",
        },
        {
          "label": "Perl",
          "value": "perl",
        },
        {
          "label": "PGP",
          "value": "pgp",
        },
        {
          "label": "PHP",
          "value": "php",
        },
        {
          "label": "Pig",
          "value": "pig",
        },
        {
          "label": "Plain text",
          "value": "",
        },
        {
          "label": "PLSQL",
          "value": "plsql",
        },
        {
          "label": "PostgreSQL",
          "value": "postgresql",
        },
        {
          "label": "PowerShell",
          "value": "powershell",
        },
        {
          "label": "Properties files",
          "value": "properties files",
        },
        {
          "label": "ProtoBuf",
          "value": "protobuf",
        },
        {
          "label": "Pug",
          "value": "pug",
        },
        {
          "label": "Puppet",
          "value": "puppet",
        },
        {
          "label": "Python",
          "value": "python",
        },
        {
          "label": "Q",
          "value": "q",
        },
        {
          "label": "R",
          "value": "r",
        },
        {
          "label": "RPM Changes",
          "value": "rpm changes",
        },
        {
          "label": "RPM Spec",
          "value": "rpm spec",
        },
        {
          "label": "Ruby",
          "value": "ruby",
        },
        {
          "label": "Rust",
          "value": "rust",
        },
        {
          "label": "SAS",
          "value": "sas",
        },
        {
          "label": "Sass",
          "value": "sass",
        },
        {
          "label": "Scala",
          "value": "scala",
        },
        {
          "label": "Scheme",
          "value": "scheme",
        },
        {
          "label": "SCSS",
          "value": "scss",
        },
        {
          "label": "Shell",
          "value": "shell",
        },
        {
          "label": "Sieve",
          "value": "sieve",
        },
        {
          "label": "Smalltalk",
          "value": "smalltalk",
        },
        {
          "label": "SML",
          "value": "sml",
        },
        {
          "label": "Solr",
          "value": "solr",
        },
        {
          "label": "SPARQL",
          "value": "sparql",
        },
        {
          "label": "Spreadsheet",
          "value": "spreadsheet",
        },
        {
          "label": "SQL",
          "value": "sql",
        },
        {
          "label": "SQLite",
          "value": "sqlite",
        },
        {
          "label": "Squirrel",
          "value": "squirrel",
        },
        {
          "label": "sTeX",
          "value": "stex",
        },
        {
          "label": "Stylus",
          "value": "stylus",
        },
        {
          "label": "Swift",
          "value": "swift",
        },
        {
          "label": "SystemVerilog",
          "value": "systemverilog",
        },
        {
          "label": "Tcl",
          "value": "tcl",
        },
        {
          "label": "Textile",
          "value": "textile",
        },
        {
          "label": "TiddlyWiki",
          "value": "tiddlywiki",
        },
        {
          "label": "Tiki wiki",
          "value": "tiki wiki",
        },
        {
          "label": "TOML",
          "value": "toml",
        },
        {
          "label": "Troff",
          "value": "troff",
        },
        {
          "label": "TSX",
          "value": "tsx",
        },
        {
          "label": "TTCN",
          "value": "ttcn",
        },
        {
          "label": "TTCN_CFG",
          "value": "ttcn_cfg",
        },
        {
          "label": "Turtle",
          "value": "turtle",
        },
        {
          "label": "TypeScript",
          "value": "typescript",
        },
        {
          "label": "VB.NET",
          "value": "vb.net",
        },
        {
          "label": "VBScript",
          "value": "vbscript",
        },
        {
          "label": "Velocity",
          "value": "velocity",
        },
        {
          "label": "Verilog",
          "value": "verilog",
        },
        {
          "label": "VHDL",
          "value": "vhdl",
        },
        {
          "label": "Vue",
          "value": "vue",
        },
        {
          "label": "Web IDL",
          "value": "web idl",
        },
        {
          "label": "WebAssembly",
          "value": "webassembly",
        },
        {
          "label": "XML",
          "value": "xml",
        },
        {
          "label": "XQuery",
          "value": "xquery",
        },
        {
          "label": "Yacas",
          "value": "yacas",
        },
        {
          "label": "YAML",
          "value": "yaml",
        },
        {
          "label": "Z80",
          "value": "z80",
        },
      ]
    `)
  })
})
