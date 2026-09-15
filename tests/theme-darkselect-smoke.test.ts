import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('dark mode component styling coverage includes requested page surfaces', () => {
  const pages = [
    'src/components/calendar/CalendarView.tsx',
    'src/components/followups/FollowUpsView.tsx',
    'src/components/opportunities/OpportunitiesView.tsx',
    'src/components/activity/ActivityView.tsx',
    'src/components/settings/SettingsView.tsx'
  ];

  const root = process.cwd();
  const missing = pages.filter(file => !fs.existsSync(path.join(root, file)));
  assert.deepEqual(missing, []);

  const darkFree = pages.reduce((acc, file) => {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    acc[file] = /dark:/i.test(source) || /bg-\[#0F172A\]|dark:bg|dark:text|dark:border/.test(source);
    return acc;
  }, {} as Record<string, boolean>);

  assert.equal(darkFree['src/components/calendar/CalendarView.tsx'], true);
  assert.equal(darkFree['src/components/followups/FollowUpsView.tsx'], true);
  assert.equal(darkFree['src/components/opportunities/OpportunitiesView.tsx'], true);
  assert.equal(darkFree['src/components/activity/ActivityView.tsx'], true);
  assert.equal(darkFree['src/components/settings/SettingsView.tsx'], true);
});

test('custom select component uses a styled select with visible dark text and caret', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'src/components/common/CustomSelect.tsx'), 'utf8');
  assert.match(source, /ChevronDown/);
  assert.match(source, /dark:text-/);
  assert.match(source, /appearance-none/);
  assert.match(source, /border border-\[#1D70F5\]/);
});
