import { defineComponent as o, useCssVars as n, openBlock as s, createElementBlock as c } from "vue";
const d = { class: "cal-calendar" }, p = /* @__PURE__ */ o({
  __name: "CalCalendar",
  props: {
    date: { default: () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) },
    view: { default: "month" },
    events: { default: () => [] },
    options: { default: () => ({}) },
    loading: { type: Boolean, default: !1 }
  },
  emits: ["update:date", "update:view", "rangeChange", "eventClick", "select", "eventMove", "eventResize"],
  setup(a) {
    return n((t) => {
      var e;
      return {
        e5c1c47e: ((e = t.options) == null ? void 0 : e.primaryColor) ?? "#1976d2"
      };
    }), (t, e) => (s(), c("div", d));
  }
}), l = (a, t) => {
  const e = a.__vccOpts || a;
  for (const [r, i] of t)
    e[r] = i;
  return e;
}, f = /* @__PURE__ */ l(p, [["__scopeId", "data-v-08e9c51f"]]), _ = { class: "cal-mini-month" }, u = /* @__PURE__ */ o({
  __name: "CalMiniMonth",
  props: {
    modelValue: { default: () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) },
    options: { default: () => ({}) }
  },
  emits: ["update:modelValue"],
  setup(a) {
    return n((t) => {
      var e;
      return {
        v95fc249c: ((e = t.options) == null ? void 0 : e.primaryColor) ?? "#1976d2"
      };
    }), (t, e) => (s(), c("div", _));
  }
}), v = /* @__PURE__ */ l(u, [["__scopeId", "data-v-039baa08"]]);
export {
  f as CalCalendar,
  v as CalMiniMonth
};
