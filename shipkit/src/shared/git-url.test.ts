import test from 'node:test';
import assert from 'node:assert/strict';
import { publicGitRepoUrl } from './git-url.js';

test('public Git URLs strip username/password and preserve the repository path', () => {
  assert.equal(publicGitRepoUrl('https://mock:MOCK%2Fpassword@git.example:8443/team/audit.git'), 'https://git.example:8443/team/audit.git');
  assert.equal(publicGitRepoUrl('https://MOCK_TOKEN@git.example/team/audit.git'), 'https://git.example/team/audit.git');
});
test('credential-free URLs and SSH scp repository paths retain their original spelling', () => {
  for (const repo of ['https://Git.Example/team/audit.git', 'https://git.example/team/path@name.git', 'git@git.example:team/audit.git']) assert.equal(publicGitRepoUrl(repo), repo);
});
test('a malformed URL still strips authority credentials before it can be logged', () => {
  assert.equal(publicGitRepoUrl('https://mock:MOCK_PASSWORD@git.example:bad/team/audit.git'), 'https://git.example:bad/team/audit.git');
});
