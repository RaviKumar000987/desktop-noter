/**
 * Python IntelliSense  — Phase 4 Extension
 * Builtins, stdlib modules, common patterns, type hints, Django/Flask snippets.
 */
"use strict";

window._exts = window._exts || {};
window._exts['python-intellisense'] = {
  id:   'python-intellisense',
  name: 'Python IntelliSense',
  icon: '🐍',
  desc: 'Python builtins, stdlib, type hints, Flask & Django patterns',
  version: '1.0.0',
  category: 'IntelliSense',

  activate(ctx) {
    document.addEventListener('monaco-ready', () => _register(ctx));
  },
};

function _register(ctx) {
  if (typeof monaco === 'undefined') return;

  // ── Python builtins ───────────────────────────────────────────────────
  const _builtins = [
    'print', 'len', 'range', 'enumerate', 'zip', 'map', 'filter', 'sorted',
    'reversed', 'list', 'dict', 'set', 'tuple', 'str', 'int', 'float', 'bool',
    'bytes', 'bytearray', 'type', 'isinstance', 'issubclass', 'hasattr',
    'getattr', 'setattr', 'delattr', 'callable', 'iter', 'next', 'super',
    'open', 'input', 'repr', 'hash', 'id', 'hex', 'oct', 'bin', 'ord', 'chr',
    'abs', 'round', 'min', 'max', 'sum', 'pow', 'divmod', 'any', 'all',
    'vars', 'dir', 'help', 'object', 'property', 'staticmethod', 'classmethod',
    'NotImplemented', 'Ellipsis', 'None', 'True', 'False',
    'Exception', 'ValueError', 'TypeError', 'AttributeError', 'KeyError',
    'IndexError', 'RuntimeError', 'StopIteration', 'FileNotFoundError',
    'PermissionError', 'OSError', 'IOError', 'NotImplementedError',
    'AssertionError', 'ImportError', 'ModuleNotFoundError', 'NameError',
    'ZeroDivisionError', 'RecursionError', 'MemoryError', 'OverflowError',
    'UnicodeDecodeError', 'UnicodeEncodeError', 'UnicodeError',
    'StopAsyncIteration', 'TimeoutError', 'ConnectionError',
  ];

  // ── stdlib module patterns ─────────────────────────────────────────
  const _stdlibSnippets = [
    { label: 'json.loads',      insertText: 'json.loads(${1:s})',                    detail: 'json — parse string' },
    { label: 'json.dumps',      insertText: 'json.dumps(${1:obj}, indent=${2:2})',    detail: 'json — serialize object' },
    { label: 'os.path.join',    insertText: 'os.path.join(${1:base}, ${2:file})',     detail: 'os — join paths' },
    { label: 'os.path.exists',  insertText: 'os.path.exists(${1:path})',              detail: 'os — check path' },
    { label: 'os.listdir',      insertText: 'os.listdir(${1:path})',                  detail: 'os — list directory' },
    { label: 'os.makedirs',     insertText: 'os.makedirs(${1:path}, exist_ok=True)',  detail: 'os — create dirs' },
    { label: 'os.environ.get',  insertText: "os.environ.get('${1:KEY}', '${2:default}')", detail: 'os — env var' },
    { label: 'sys.argv',        insertText: 'sys.argv[1:]',                           detail: 'sys — command args' },
    { label: 'sys.exit',        insertText: 'sys.exit(${1:0})',                       detail: 'sys — exit' },
    { label: 're.findall',      insertText: "re.findall(r'${1:pattern}', ${2:text})",  detail: 're — findall' },
    { label: 're.search',       insertText: "re.search(r'${1:pattern}', ${2:text})",   detail: 're — search' },
    { label: 're.sub',          insertText: "re.sub(r'${1:pattern}', '${2:repl}', ${3:text})", detail: 're — substitute' },
    { label: 're.compile',      insertText: "re.compile(r'${1:pattern}')",             detail: 're — compile pattern' },
    { label: 'datetime.now',    insertText: 'datetime.datetime.now()',                 detail: 'datetime — current time' },
    { label: 'datetime.strptime',insertText: "datetime.datetime.strptime(${1:s}, '${2:%Y-%m-%d}')", detail: 'datetime — parse' },
    { label: 'pathlib.Path',    insertText: 'pathlib.Path(${1:path})',                 detail: 'pathlib — Path object' },
    { label: 'Path.read_text',  insertText: '${1:path}.read_text(encoding="utf-8")',   detail: 'pathlib — read file' },
    { label: 'Path.write_text', insertText: '${1:path}.write_text(${2:data}, encoding="utf-8")', detail: 'pathlib — write file' },
    { label: 'collections.defaultdict', insertText: 'collections.defaultdict(${1:list})', detail: 'collections — defaultdict' },
    { label: 'collections.Counter',    insertText: 'collections.Counter(${1:iterable})',  detail: 'collections — Counter' },
    { label: 'itertools.chain',  insertText: 'itertools.chain(${1:*iterables})',       detail: 'itertools — chain' },
    { label: 'functools.lru_cache', insertText: '@functools.lru_cache(maxsize=${1:None})\ndef ${2:fn}(${3:arg}):\n\t${4:pass}', detail: 'functools — memoize' },
    { label: 'threading.Thread',insertText: 't = threading.Thread(target=${1:fn}, args=(${2:arg},))\nt.start()', detail: 'threading — create thread' },
    { label: 'subprocess.run',  insertText: "subprocess.run(['${1:cmd}', '${2:arg}'], capture_output=True, text=True)", detail: 'subprocess — run command' },
    { label: 'logging.basicConfig', insertText: "logging.basicConfig(level=logging.${1:INFO}, format='%(asctime)s - %(levelname)s - %(message)s')", detail: 'logging — setup' },
    { label: 'logging.getLogger', insertText: "logger = logging.getLogger('${1:__name__}')", detail: 'logging — get logger' },
    { label: 'argparse.ArgumentParser', insertText: "parser = argparse.ArgumentParser(description='${1:desc}')\nparser.add_argument('${2:--flag}', help='${3:help}')\nargs = parser.parse_args()", detail: 'argparse — CLI args' },
    { label: 'unittest.TestCase', insertText: "class Test${1:Name}(unittest.TestCase):\n\tdef test_${2:case}(self):\n\t\tself.assertEqual(${3:a}, ${4:b})", detail: 'unittest — test case' },
    { label: 'pytest.raises',   insertText: "with pytest.raises(${1:ValueError}):\n\t${2:fn()}", detail: 'pytest — assert raises' },
    { label: 'dataclasses.field', insertText: "field(default_factory=${1:list})",     detail: 'dataclasses — field with factory' },
  ];

  // ── Type hint completions ─────────────────────────────────────────
  const _typeHints = [
    { label: 'List[',      insertText: 'List[${1:str}]',              detail: 'type hint' },
    { label: 'Dict[',      insertText: 'Dict[${1:str}, ${2:Any}]',    detail: 'type hint' },
    { label: 'Optional[',  insertText: 'Optional[${1:str}]',          detail: 'type hint' },
    { label: 'Union[',     insertText: 'Union[${1:str}, ${2:int}]',   detail: 'type hint' },
    { label: 'Tuple[',     insertText: 'Tuple[${1:str}, ...]',        detail: 'type hint' },
    { label: 'Set[',       insertText: 'Set[${1:str}]',               detail: 'type hint' },
    { label: 'Callable[',  insertText: 'Callable[[${1:arg}], ${2:ret}]', detail: 'type hint' },
    { label: 'Any',        insertText: 'Any',                         detail: 'type hint — any type' },
    { label: 'ClassVar[',  insertText: 'ClassVar[${1:str}]',          detail: 'type hint — class variable' },
    { label: 'TypeVar',    insertText: "T = TypeVar('T')",             detail: 'type var' },
    { label: 'Protocol',   insertText: 'class ${1:Name}(Protocol):\n\tdef ${2:method}(self) -> ${3:None}: ...', detail: 'Protocol type' },
    { label: 'TypedDict',  insertText: 'class ${1:Name}(TypedDict):\n\t${2:key}: ${3:str}', detail: 'TypedDict' },
    { label: 'Final[',     insertText: 'Final[${1:str}]',             detail: 'Final type hint' },
    { label: 'Literal[',   insertText: "Literal['${1:value}']",       detail: 'Literal type' },
  ];

  // ── Flask patterns ────────────────────────────────────────────────
  const _flaskSnippets = [
    { label: 'flask.app',       insertText: "from flask import Flask, request, jsonify\n\napp = Flask(__name__)\n\n@app.route('/')\ndef index():\n\treturn jsonify({'ok': True})\n\nif __name__ == '__main__':\n\tapp.run(debug=True)", detail: 'Flask — app setup' },
    { label: '@app.route',      insertText: "@app.route('${1:/path}', methods=['${2:GET}'])\ndef ${3:view}():\n\treturn jsonify({'${4:key}': '${5:val}'})", detail: 'Flask route' },
    { label: 'request.json',    insertText: 'data = request.get_json()',   detail: 'Flask — get JSON body' },
    { label: 'request.args',    insertText: "val = request.args.get('${1:param}')", detail: 'Flask — query param' },
    { label: 'jsonify',         insertText: "return jsonify({'${1:key}': ${2:val}}), ${3:200}", detail: 'Flask — JSON response' },
    { label: 'flask.Blueprint', insertText: "from flask import Blueprint\n\nbp = Blueprint('${1:name}', __name__, url_prefix='/${1:name}')\n\n@bp.route('/')\ndef index():\n\treturn 'ok'", detail: 'Flask blueprint' },
  ];

  // ── Django patterns ───────────────────────────────────────────────
  const _djangoSnippets = [
    { label: 'django.view',     insertText: "from django.http import JsonResponse\nfrom django.views import View\n\nclass ${1:Name}View(View):\n\tdef get(self, request):\n\t\treturn JsonResponse({'ok': True})\n\n\tdef post(self, request):\n\t\treturn JsonResponse({'created': True}, status=201)", detail: 'Django class-based view' },
    { label: 'django.model',    insertText: "from django.db import models\n\nclass ${1:Name}(models.Model):\n\t${2:name} = models.CharField(max_length=${3:255})\n\tcreated_at = models.DateTimeField(auto_now_add=True)\n\n\tclass Meta:\n\t\tordering = ['-created_at']", detail: 'Django model' },
    { label: 'django.serializer', insertText: "from rest_framework import serializers\n\nclass ${1:Name}Serializer(serializers.ModelSerializer):\n\tclass Meta:\n\t\tmodel = ${2:Model}\n\t\tfields = ['${3:id}', '${4:name}']", detail: 'DRF serializer' },
  ];

  // ── Register completion provider ──────────────────────────────────
  const allSnippets = [..._stdlibSnippets, ..._typeHints, ..._flaskSnippets, ..._djangoSnippets];

  monaco.languages.registerCompletionItemProvider('python', {
    triggerCharacters: ['.', ' ', '('],
    provideCompletionItems(model, position) {
      const word  = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
        startColumn: word.startColumn, endColumn: word.endColumn,
      };
      const snippetSuggestions = allSnippets.map(s => ({
        label: s.label,
        kind:  monaco.languages.CompletionItemKind.Snippet,
        detail: s.detail || 'Python',
        insertText: s.insertText,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        sortText: 'b' + s.label,
        range,
      }));
      const builtinSuggestions = _builtins.map(b => ({
        label: b,
        kind:  monaco.languages.CompletionItemKind.Function,
        detail: 'Python builtin',
        insertText: b,
        sortText: 'c' + b,
        range,
      }));
      return { suggestions: [...snippetSuggestions, ...builtinSuggestions] };
    },
  });

  // ── Hover docs for Python builtins ────────────────────────────────
  const _pyHover = {
    'len':       '**len(s)**\nReturn the number of items in an object.',
    'range':     '**range([start], stop[, step])**\nReturn a range object representing the sequence of integers.',
    'enumerate': '**enumerate(iterable, start=0)**\nReturn an enumerate object yielding (index, value) tuples.',
    'zip':       '**zip(*iterables)**\nAggregate elements from each of the iterables into tuples.',
    'map':       '**map(func, iterable)**\nApply func to every item of iterable and return a map object.',
    'filter':    '**filter(func, iterable)**\nReturn an iterator yielding items for which func(item) is true.',
    'sorted':    '**sorted(iterable, key=None, reverse=False)**\nReturn a new sorted list from the items in iterable.',
    'isinstance':'**isinstance(object, classinfo)**\nReturn True if object is an instance of the specified class(es).',
    'getattr':   '**getattr(object, name[, default])**\nReturn the value of the named attribute of object.',
    'hasattr':   '**hasattr(object, name)**\nReturn True if the object has the named attribute.',
    'print':     '**print(*objects, sep=" ", end="\\n")**\nPrint objects to the text stream.',
    'open':      '**open(file, mode="r", encoding=None)**\nOpen file and return a file object.',
    'super':     '**super([type[, object-or-type]])**\nReturn a proxy object that delegates method calls to a parent class.',
    'property':  '**@property**\nBuilt-in decorator that turns a method into a getter for a managed attribute.',
    'classmethod':'**@classmethod**\nTransform a method into a class method bound to the class.',
    'staticmethod':'**@staticmethod**\nTransform a method into a static method with no implicit first argument.',
  };

  monaco.languages.registerHoverProvider('python', {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const doc = _pyHover[word.word];
      if (!doc) return null;
      return {
        range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
        contents: [{ value: doc }],
      };
    },
  });
}
