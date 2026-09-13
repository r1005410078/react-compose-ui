/** 编辑器偏好：快捷键协议、规范化、冲突检测与设置中心。 */
export {
  COMPOSE_EDITOR_SHORTCUT_ACTIONS,
  COMPOSE_EDITOR_SHORTCUT_SCOPES,
  createDefaultComposeEditorPreferences,
  createDefaultComposeEditorWorkspacePreferences,
  findComposeEditorShortcutConflict,
  formatComposeEditorKeybinding,
  isComposeEditorKeybindingMatch,
  isEditableKeyboardTarget,
  normalizeComposeEditorKeybinding,
  normalizeComposeEditorPreferences,
  normalizeComposeEditorWorkspacePreferences,
  type ComposeEditorKeybinding,
  COMPOSE_CROSSHAIR_SIZE_DEFAULT,
  COMPOSE_CROSSHAIR_SIZE_RANGE,
  type ComposeEditorCrosshairStyle,
  type ComposeEditorPreferences,
  type ComposeEditorShortcutAction,
  type ComposeEditorShortcutScope,
  type ComposeEditorWorkspacePreferences,
} from './preferences'
export { SettingsDialog } from './settings-panel'
