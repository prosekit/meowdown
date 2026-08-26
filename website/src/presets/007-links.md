# Link previews

Hover any link and wait a beat. Metadata is derived locally in `demo-data.ts`.

## Derived metadata

- Labelled: [Meowdown on GitHub](https://github.com/prosekit/meowdown)
- With a tooltip: [The spec](https://commonmark.org/help/ "CommonMark cheatsheet")
- URL-labelled: [https://commonmark.org](https://commonmark.org)
- Bare autolink: commonmark.org
- Angle autolink: <https://commonmark.org>
- Unregistered domain: [mystery page](https://mystery.example.net/page)
- Non-web destination, resolver never runs: [email us](mailto:meow@example.com)

## Read-only forms

A reference link keeps Copy only, because `[docs]` owns the destination:

[CommonMark docs][docs]

[docs]: https://commonmark.org
