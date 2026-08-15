# 릴리스 가이드

calvue를 npm에 배포하는 절차입니다. 자동화된 배포 파이프라인은 없습니다 — CI는 검증(`typecheck` + `build`)만 하고, 배포는 수동입니다.

> **CHANGELOG.md는 두지 않습니다.** 변경 이력은 GitHub Release 노트로 관리합니다.

---

## ⚠️ 가장 중요한 함정

**`npm publish`는 빌드를 하지 않습니다.**

`package.json`에 `prepublishOnly` 같은 훅이 없어서, `publish`는 그 순간 `dist/` 폴더에 있는 것을 그대로 올립니다. `dist/`는 `.gitignore`에 있어서 git이 상태를 알려주지도 않습니다.

즉 **빌드를 깜빡하면 예전 코드가 그대로 배포되고, npm은 같은 버전 재배포를 허용하지 않습니다.** 반드시 publish 직전에 `yarn build`를 돌리세요. 아래 절차는 이 순서를 강제합니다.

---

## 배포 절차

### 0. 사전 조건

```bash
git checkout main
git pull
git status          # 반드시 clean 이어야 함
npm whoami          # 로그인 안 돼 있으면 401 → npm login
```

`npm whoami`가 실패하면:

```bash
npm login           # 브라우저 인증 또는 OTP
```

### 1. 버전 올리기

`package.json`의 `version`을 직접 수정합니다. calvue는 아직 1.0 이전이라 아래 기준을 씁니다:

| 상황 | 올리는 자리 | 예 |
|---|---|---|
| 타입/API 제거·변경 (breaking) | minor | `0.2.0` → `0.3.0` |
| 기능 추가, 동작 변화가 있는 버그 수정 | minor | `0.2.0` → `0.3.0` |
| 순수 버그 수정, 문서 | patch | `0.2.0` → `0.2.1` |

> pre-1.0에서는 minor가 breaking 자리 역할을 합니다. 1.0 이후엔 통상적인 semver로 전환하세요.

버전만 바꾸는 커밋을 만들고 PR로 올립니다 (`main` 직접 push 금지 — CI를 거치게):

```bash
git checkout -b release/vX.Y.Z
# package.json 의 version 수정
git commit -m "chore(release): vX.Y.Z" -- package.json
git push -u origin release/vX.Y.Z
gh pr create --base main --title "chore(release): vX.Y.Z" --body "버전 범프"
```

PR CI가 통과하면 머지하고, `main`을 다시 pull 합니다.

### 2. 빌드 + 검증

```bash
git checkout main && git pull
yarn typecheck
yarn build
```

둘 다 에러 없이 끝나야 합니다.

> 빌드 후 `auto-imports.d.ts` / `components.d.ts`가 수정된 것으로 보일 수 있습니다. 내용은 같고 **줄바꿈(LF/CRLF)만** 다른 노이즈입니다. `git diff`가 비어 있는지 확인하고 `git checkout -- <파일>`로 되돌리세요. (이 저장소에 `.gitattributes`가 없어서 생기는 현상입니다.)

### 3. 배포될 내용 확인

```bash
npm pack --dry-run
```

확인 사항:

- `dist/index.js`, `dist/index.d.ts`, `dist/style.css`가 들어 있는가
- `version`이 의도한 값인가
- `src/`, `playground/`, `docs/`가 **들어가면 안 됩니다** (`package.json`의 `files: ["dist"]`가 막아줍니다 — LICENSE·README·package.json은 npm이 항상 포함)

`npm pack --dry-run`은 파일을 만들지 않습니다. 실수로 `--dry-run` 없이 돌렸다면 생성된 `.tgz`를 지우세요.

### 4. 배포

```bash
npm publish
```

2FA가 켜져 있으면 OTP를 묻습니다. 또는 미리 넘길 수도 있습니다:

```bash
npm publish --otp=123456
```

### 5. 태그 + GitHub Release

배포가 성공한 **뒤에** 태그를 답니다. 순서가 이래야 publish가 실패했을 때 정리할 게 없습니다.

```bash
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z

gh release create vX.Y.Z --title "vX.Y.Z" --notes-file <노트파일>
```

릴리스 노트에 반드시 담아야 할 것:

- **Breaking** — 타입만 바뀐 것인지, 런타임 동작도 바뀌는지 명시
- **동작 변화** — 기존 사용자가 코드를 안 바꿔도 화면이 달라지는 변경. 놓치기 쉬운데 가장 중요합니다
- **Added / Fixed**
- **알려진 제약** — 의도적으로 남긴 이슈. 적어두지 않으면 나중에 "놓친 버그"로 읽힙니다

### 6. 배포 후 확인

```bash
npm view calvue version      # 방금 올린 버전이 나와야 함
npm view calvue dist-tags
```

npm 페이지(https://www.npmjs.com/package/calvue)에서 README가 갱신됐는지도 확인하세요 — npm은 배포된 README를 페이지에 렌더링합니다.

---

## 배포를 되돌려야 한다면

**npm은 같은 버전 번호를 두 번 배포할 수 없습니다.** 잘못 올렸어도 고쳐서 같은 번호로 다시 올릴 수 없습니다.

- **72시간 이내**: `npm unpublish calvue@X.Y.Z` 가 가능할 수 있습니다(의존하는 패키지가 없는 등 조건이 붙습니다). 성공하더라도 그 버전 번호는 영구히 재사용 불가입니다.
- **72시간 이후**: 내릴 수 없습니다. 실무적 대응은 다음 패치 버전을 올리고 문제 버전을 표시해 두는 것입니다:

  ```bash
  npm deprecate calvue@X.Y.Z "잘못된 빌드가 포함됐습니다. X.Y.Z+1 이상을 사용하세요"
  ```

이런 상황이 대부분 **빌드를 빼먹어서** 생깁니다. 3단계(`npm pack --dry-run`)를 건너뛰지 마세요.

---

## 개선 여지 (미적용)

`package.json`에 아래를 넣으면 빌드 누락이 구조적으로 불가능해집니다:

```json
"prepublishOnly": "yarn typecheck && yarn build"
```

지금은 없습니다. 도입하면 위 2·3단계를 사람이 기억할 필요가 없어집니다.
