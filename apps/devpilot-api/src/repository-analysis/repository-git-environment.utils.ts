const DEFAULT_PATH = "/usr/local/bin:/usr/bin:/bin";

export function repositoryGitEnvironment(
  home: string,
  source: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const locale = source.LC_ALL || source.LANG || "C.UTF-8";
  return {
    PATH: source.PATH || DEFAULT_PATH,
    LANG: locale,
    LC_ALL: locale,
    HOME: home,
    XDG_CONFIG_HOME: home,
    GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_OPTIONAL_LOCKS: "0",
  };
}
