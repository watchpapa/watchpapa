// Commit messages must follow Conventional Commits: type(scope): subject
// e.g. refactor(time): extract parseDateStr to remove duplicated date splitting
export default {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        // House rule: no Claude/AI co-author trailer in my commits.
        "no-claude-coauthor": (parsed) => [
          !/co-authored-by:.*claude/i.test(parsed.raw),
          "commit messages must not contain a Co-Authored-By: Claude line",
        ],
      },
    },
  ],
  rules: {
    "no-claude-coauthor": [2, "always"],
    // Body lines can be long, only the first line (the subject) is limited.
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
  },
};
