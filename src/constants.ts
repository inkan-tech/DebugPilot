// Tool names (Phase 1 — read-only)
export const TOOL_DEBUG_SESSIONS = "debug_sessions";
export const TOOL_DEBUG_STATE = "debug_state";
export const TOOL_DEBUG_VARIABLES = "debug_variables";
export const TOOL_DEBUG_EVALUATE = "debug_evaluate";
export const TOOL_DEBUG_CONSOLE = "debug_console";
export const TOOL_DEBUG_BREAKPOINTS_LIST = "debug_breakpoints_list";

// Tool names (Phase 2 — control)
export const TOOL_DEBUG_CONTINUE = "debug_continue";
export const TOOL_DEBUG_STEP = "debug_step";
export const TOOL_DEBUG_PAUSE = "debug_pause";
export const TOOL_DEBUG_BREAKPOINT_SET = "debug_breakpoint_set";
export const TOOL_DEBUG_BREAKPOINT_REMOVE = "debug_breakpoint_remove";
export const TOOL_DEBUG_EXCEPTION_CONFIG = "debug_exception_config";

export const TOOL_DEBUG_LAUNCH = "debug_launch";
export const TOOL_DEBUG_STOP = "debug_stop";
export const TOOL_DEBUG_LOGPOINT_SET = "debug_logpoint_set";
export const TOOL_DEBUG_RUN_TO = "debug_run_to";

// Tool names (Flutter/Dart)
export const TOOL_DEBUG_HOT_RELOAD = "debug_hot_reload";
export const TOOL_DEBUG_HOT_RESTART = "debug_hot_restart";

// Defaults
export const DEFAULT_CONSOLE_BUFFER_SIZE = 10_000;
export const DEFAULT_VARIABLE_DEPTH_LIMIT = 1;
export const MAX_VARIABLE_DEPTH = 5;
export const DEFAULT_SOURCE_CONTEXT_LINES = 10;

// Extension
export const EXTENSION_ID = "debugpilot";
export const CONFIG_SECTION = "debugPilot";
