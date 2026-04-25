/**
 * Standalone harness that reproduces the bulk-script signal handling pattern.
 * Spawned by tests to verify SIGINT/SIGTERM produces the expected exit
 * behaviour without needing a database connection.
 *
 * Usage:  node signal_test_harness.js <signal> [emitCount]
 *   signal    – "SIGINT" or "SIGTERM" (default "SIGINT")
 *   emitCount – how many times to emit the signal (default 1)
 */

const signal = process.argv[2] || "SIGINT";
const emitCount = Math.max(1, parseInt(process.argv[3] || "1", 10));

let logWritten = false;

function handleStopSignal(sig) {
  if (logWritten) return;
  logWritten = true;
  process.stderr.write(
    `\nReceived ${sig}. Writing stopped log and exiting...\n`
  );
  Promise.resolve()
    .then(() => process.exit(1));
}

process.on("SIGINT", handleStopSignal);
process.on("SIGTERM", handleStopSignal);

for (let i = 0; i < emitCount; i++) {
  process.emit(signal, signal);
}

setTimeout(() => {
  process.stderr.write("ERROR: signal handler did not exit the process.\n");
  process.exit(2);
}, 1000);
