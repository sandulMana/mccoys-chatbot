<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Password recovery lives on the public `/reset-password` route, separate from sign-in redirects, so recovery sessions can set a password before entering the studio.
- Keep the root identity-change subscriber as the sole auth-state listener; sign-in actions navigate explicitly to avoid competing redirects.
- Flyer PSDs are built from the PNG by the pure-JS writer in `src/lib/psd.server.ts` — no canvas/native deps, so it stays edge-runtime safe; edit it, don't swap in an image library.
