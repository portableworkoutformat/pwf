# Contributing to PWF

Thanks for helping shape the Portable Workout Format. PWF is a v0.1 draft, so the format can still change, and the most useful contributions right now are proposals, test cases and feedback from people building workout apps.

## Ways to contribute

- **Questions and ideas:** start a [discussion](https://github.com/portableworkoutformat/pwf/discussions).
- **Bugs** in the schema, tools or conformance suite: open an issue with the bug report template.
- **Changes to the format:** open an issue with the format proposal template before writing a pull request. Every change affects every app that implements PWF, so we agree the design first.
- **Small fixes** such as typos, clearer descriptions and docs: open a pull request directly.

## Making a change

1. Fork the repo and create a branch.
2. Run `npm install`, make your change, then run `npm run check`.
3. If your change affects how a workout plays, add or update a conformance case: a document, its expected timeline and a `manifest.json` entry with a total worked out by hand. See [conformance/README.md](conformance/README.md).
4. If your change alters a decision, update [DECISIONS.md](DECISIONS.md) in the same pull request.
5. Sign off every commit (see below), then open a pull request.

## Review

Every pull request gets an automated review from Claude, which sorts its findings into **Blocking** and **Non-blocking**:

- **Blocking** findings stop the merge until they're fixed, or until a maintainer agrees they don't apply. They cover things like the spec, schema and tests disagreeing, a timing change without a conformance case, a bug, or a security problem.
- **Non-blocking** findings are suggestions. Take them or leave them, with a short reply if you decline one.

Each new push is reviewed again. Pull requests from forks are reviewed once a maintainer comments `/review`, and maintainers can use the same comment to re-run a review. A maintainer also reads every pull request before merging.

## Sign off your commits

PWF uses the [Developer Certificate of Origin](https://developercertificate.org) (DCO). Signing off a commit certifies that you wrote the change, or otherwise have the right to submit it under the project's licences. Add the sign-off with `git commit -s`, which appends a line like this:

```text
Signed-off-by: Your Name <you@example.com>
```

A check on every pull request makes sure each commit is signed off. To add a missing sign-off to the commits on your branch, run `git rebase --signoff main` and force-push the branch.

## Licences

- Contributions to the spec, schema, conformance suite and tools are licensed under [Apache-2.0](LICENSE).
- Contributions to the exercise and equipment registries are dedicated to the public domain under [CC0 1.0](LICENSES/CC0-1.0.txt).

## Code of conduct

Everyone taking part in PWF follows the [Code of Conduct](CODE_OF_CONDUCT.md).
