const { detectFramework } = require('./src/analysis/frameworkDetector');
const { detectTestRunner } = require('./src/environment/detectTestRunner');
const { runQualityGate } = require('./src/generation/validateOutput');

let passed = 0; let failed = 0;
function assert(label, condition, actual) {
    if (condition) { console.log(`  ✅ PASS: ${label}`); passed++; }
    else { console.log(`  ❌ FAIL: ${label} — got: ${JSON.stringify(actual)}`); failed++; }
}

console.log('\n=== Framework Detection — nexusops ===\n');
const nexusRoot = 'd:/hosting/nexusops';
const f = detectFramework(nexusRoot);
assert('Detects Next.js',         f.isNextJs === true, f.isNextJs);
assert('Has confidence > 50%',    f.confidence > 50,   f.confidence);
assert('Has evidence array',      Array.isArray(f.evidence), typeof f.evidence);
assert('Has conflicts array',     Array.isArray(f.conflicts), typeof f.conflicts);
assert('isVue is false',          f.isVue === false, f.isVue);
assert('isAngular is false',      f.isAngular === false, f.isAngular);
console.log(`  ℹ Framework: ${f.framework} (${f.confidence}%) — evidence: ${f.evidence.slice(0,3).map(e=>e.reason).join(' | ')}`);

console.log('\n=== Runner Detection — nexusops ===\n');
const r = detectTestRunner(nexusRoot, f);
assert('Runner is jest',          r.runner === 'jest', r.runner);
assert('Returns signals array',   Array.isArray(r.signals), typeof r.signals);
assert('Returns conflicts array', Array.isArray(r.conflicts), typeof r.conflicts);

console.log('\n=== Dangerous Pattern Blocking ===\n');
const q1 = runQualityGate("const cp = require('child_process'); cp.execSync('ls');", '.js');
assert("require('child_process') blocked",  q1.some(w => w.startsWith('SECURITY')), q1);

const q2 = runQualityGate('const r = eval(userInput);', '.js');
assert('eval() blocked',                    q2.some(w => w.startsWith('SECURITY')), q2);

const q3 = runQualityGate("fs.writeFileSync('/etc/hosts', data);", '.js');
assert('fs.writeFileSync() blocked',        q3.some(w => w.startsWith('SECURITY')), q3);

const q4 = runQualityGate('const k = process.env.API_KEY;', '.js');
assert('process.env.API_KEY blocked',       q4.some(w => w.startsWith('SECURITY')), q4);

const q5 = runQualityGate('const fn = new Function("return 1+1");', '.js');
assert('new Function() blocked',            q5.some(w => w.startsWith('SECURITY')), q5);

const q6 = runQualityGate("it('should return correct result', () => { expect(add(1,2)).toBe(3); });", '.js');
assert('Clean test passes all gates',       q6.length === 0, q6);

console.log(`\n=== Extended Framework Flags ===\n`);
assert('isVue flag exists',     typeof f.isVue     === 'boolean', typeof f.isVue);
assert('isNuxt flag exists',    typeof f.isNuxt    === 'boolean', typeof f.isNuxt);
assert('isAngular flag exists', typeof f.isAngular === 'boolean', typeof f.isAngular);
assert('isSvelte flag exists',  typeof f.isSvelte  === 'boolean', typeof f.isSvelte);
assert('isRemix flag exists',   typeof f.isRemix   === 'boolean', typeof f.isRemix);
assert('isAstro flag exists',   typeof f.isAstro   === 'boolean', typeof f.isAstro);
assert('isExpress flag exists', typeof f.isExpress === 'boolean', typeof f.isExpress);
assert('isNestJS flag exists',  typeof f.isNestJS  === 'boolean', typeof f.isNestJS);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
