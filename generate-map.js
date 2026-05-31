/**
 * Metro auto-generation hook for screen mapping.
 * 
 * Usage in metro.config.js:
 *   require('@mobileai/react-native/generate-map').autoGenerate(__dirname);
 * 
 * Runs synchronously when Metro config loads — screen map is always fresh on dev start.
 */

const { execSync } = require('child_process');
const path = require('path');

/**
 * Auto-generate ai-screen-map.json for the given project directory.
 * Runs the CLI synchronously so Metro waits for it to finish before bundling.
 * 
 * @param {string} projectDir - Absolute path to the project root (use __dirname in metro.config.js)
 * @param {object} [options] - Optional configuration
 * @param {boolean} [options.silent=false] - Suppress output
 */
function autoGenerate(projectDir, options = {}) {
  const cliPath = path.resolve(__dirname, 'bin', 'generate-map.cjs');
  const cmd = `node "${cliPath}" --dir="${projectDir}"`;

  try {
    const output = execSync(cmd, {
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
    });
    return output;
  } catch (err) {
    // Don't crash Metro on generation failure — warn and continue
    console.warn('[AIAgent] ⚠️ Screen map generation failed:', err.message);
    console.warn('[AIAgent] The AI will work without navigation intelligence.');
    return null;
  }
}

module.exports = { autoGenerate };
