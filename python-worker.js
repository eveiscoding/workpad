const distribution = 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/';
let python;

self.onmessage = async ({ data: code }) => {
  let globals;
  let result;
  let output = '';
  const append = (line) => {
    if (output.length < 12000) output = (output + line + '\n').slice(0, 12000);
  };
  try {
    if (!python) {
      importScripts(distribution + 'pyodide.js');
      python = await loadPyodide({ indexURL: distribution });
    }
    self.postMessage({ ready: true });
    python.setStdout({ batched: append });
    python.setStderr({ batched: append });
    python.setStdin({ stdin: () => null });
    globals = python.toPy({ __name__: '__main__' });
    result = await python.runPythonAsync(code, { globals });
    if (result !== undefined && result !== null) append(String(result));
    self.postMessage({ output: output.trimEnd() || '运行完成' });
  } catch (error) {
    append(String(error.message || error));
    self.postMessage({ output: output.trimEnd() });
  } finally {
    result?.destroy?.();
    globals?.destroy();
  }
};
