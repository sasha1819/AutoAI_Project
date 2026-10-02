// Internals shared by the form controls (Input, Select, Checkbox, Switch): the field look and the label / hint /
// error wiring. Not a component; screens use the controls (deps rule features-use-public-primitives).
export {
  FIELD_HEIGHT,
  FIELD_LOOK,
  FieldFrame,
  type FieldSize,
  type FieldWiring,
} from "./field-frame.tsx";
