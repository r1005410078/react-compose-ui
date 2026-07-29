/** 编辑器偏好：快捷键协议、规范化、冲突检测与设置中心。 */
export {
  COMPOSE_EDITOR_SHORTCUT_ACTIONS,
  COMPOSE_EDITOR_SHORTCUT_SCOPES,
  createDefaultComposeEditorPreferences,
  findComposeEditorShortcutConflict,
  formatComposeEditorKeybinding,
  isComposeEditorKeybindingMatch,
  isEditableKeyboardTarget,
  normalizeComposeEditorKeybinding,
  normalizeComposeEditorPreferences,
  type ComposeEditorKeybinding,
  type ComposeEditorPreferences,
  type ComposeEditorShortcutAction,
  type ComposeEditorShortcutScope,
} from './preferences'
export { SettingsDialog } from './settings-panel'
