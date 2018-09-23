const test = require("ava")

const { compile, metaGrammarSource } = require("../grammar")
const { nearleyFromGrammar } = require("../nearley")

function stripFunction(func) {
  return ("" + func)
    .replace(/^function[^{]+\{/, "")
    .replace(/\}$/, "")
    .trim()
}

function nearleyRulesToJSON(rules) {
  return rules.map(rule => {
    return {
      name: rule.name,
      symbols: rule.symbols,
      process: stripFunction(rule.postprocess),
    }
  })
}

function nearleyRulesToString(rules) {
  return rules.map(rule => {
    return rule.toString() //+ "  {% d => { " + stripFunction(rule.postprocess) + "} %}"
  })
}

function nearleyRules(grammar) {
  return nearleyRulesToJSON(nearleyFromGrammar(grammar).rules)
}

test("null processor", t => {
  const grammar = compile(`foo -> bar "quxx"`)
  t.deepEqual(nearleyRules(grammar), [
    { name: "foo", symbols: ["bar", { type: "quxx" }], process: "return null" },
  ])
})

test("root processor", t => {
  const grammar = compile(`foo -> "(" :bar ")"`)
  t.deepEqual(nearleyRules(grammar), [
    { name: "foo", symbols: [{ type: "(" }, "bar", { type: ")" }], process: "return d[1]" },
  ])
})

test("root token", t => {
  const grammar = compile(`foo -> "(" :"quxx" ")"`)
  t.deepEqual(nearleyRules(grammar), [
    {
      name: "foo",
      symbols: [{ type: "(" }, { type: "quxx" }, { type: ")" }],
      process: "return d[1].value",
    },
  ])
})

test("object processor", t => {
  const grammar = compile(`foo Obj -> one:bar two:"quxx"`)
  t.deepEqual(nearleyRules(grammar), [
    {
      name: "foo",
      symbols: ["bar", { type: "quxx" }],
      process: `return new Node("Obj", null, {\n"one": d[0],\n"two": d[1].value,\n})`,
    },
  ])
})

test("object with no keys", t => {
  const grammar = compile(`foo Obj -> bar "quxx"`)
  t.deepEqual(nearleyRules(grammar), [
    {
      name: "foo",
      symbols: ["bar", { type: "quxx" }],
      process: `return new Node("Obj", null, {\n})`,
    },
  ])
})

test("list processor", t => {
  const grammar = compile(`statements [] -> []:statements ";" :stmt`)
  t.deepEqual(nearleyRules(grammar), [
    {
      name: "statements",
      symbols: ["statements", { type: ";" }, "stmt"],
      process: `var list = d[0].slice()\nlist.push(d[2])\nreturn list`,
    },
  ])
})

test("empty list", t => {
  const grammar = compile(`statements [] ->`)
  t.deepEqual(nearleyRules(grammar), [
    {
      name: "statements",
      symbols: [],
      process: `return []`,
    },
  ])
})

test("one-item list", t => {
  const grammar = compile(`statements [] -> "~" :stmt`)
  t.deepEqual(nearleyRules(grammar), [
    {
      name: "statements",
      symbols: [{ type: "~" }, "stmt"],
      process: `return [d[1]]`,
    },
  ])
})

test("compile meta-grammar", t => {
  const grammar = compile(metaGrammarSource)
  const nearleyGrammar = nearleyFromGrammar(grammar)
  t.deepEqual(nearleyRulesToString(nearleyGrammar.rules), [
    "grammar → blankLines rules blankLines",

    "blankLines → ",
    "blankLines → blankLines %newline",

    "rules → rules %newline blankLines rule",
    "rules → ",

    "rule → %identifier nodeType %arrow children optionalSpace",

    "optionalSpace → %space",
    "optionalSpace → ",

    "nodeType → %space",
    "nodeType → %space %identifier %space",
    "nodeType → %space %list %space",

    "children → children %space child",
    "children → ",

    "child → symbol",
    "child → key %: symbol",

    "key → ",
    "key → %list",
    "key → %identifier",

    "symbol → match %?",
    "symbol → match %+",
    "symbol → match %*",

    "match → %string",
    "match → %identifier",
  ])
})