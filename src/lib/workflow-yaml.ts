/**
 * The GitHub Actions workflow that performs the REAL APK build on GitHub's runners.
 * It is pushed to the build repo (.github/workflows/wevlo-build.yml) during setup,
 * then triggered with workflow_dispatch for every build.
 *
 * Flow: download source zip from our site → gradle assembleDebug (JDK17 + AGP 8.5.2)
 *       → upload APK artifact → POST callback to our site (success / failure).
 */

export const WORKFLOW_PATH = '.github/workflows/wevlo-build.yml'
export const WORKFLOW_NAME = 'wevlo-build.yml'

// AGP 8.5.2 ↔ Gradle 8.9 ↔ JDK 17 ↔ compileSdk 34
export const GRADLE_VERSION = '8.9'

export function buildWorkflowYaml(): string {
  const d = '$' + '{{' // literal ${{ for GitHub expressions
  const gh = (s: string) => `${d} ${s} ${'}'.repeat(2)}`

  return `name: ApkForge APK Builder
run-name: "APK build ${gh('inputs.build_id')}"

on:
  workflow_dispatch:
    inputs:
      build_id:
        description: 'Unique build id from the website'
        required: true
      source_url:
        description: 'Signed URL of the generated Gradle project ZIP'
        required: true
      callback_url:
        description: 'Website callback endpoint'
        required: true
      callback_secret:
        description: 'Per-build callback secret'
        required: true
      apk_name:
        description: 'Final APK file name'
        required: true
      artifact_name:
        description: 'Artifact name'
        required: true

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 35
    permissions:
      contents: read
    steps:
      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'

      - name: Set up Gradle ${GRADLE_VERSION}
        run: |
          curl -fsSL -o /tmp/gradle.zip "https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip"
          sudo unzip -q /tmp/gradle.zip -d /opt
          echo "/opt/gradle-${GRADLE_VERSION}/bin" >> "$GITHUB_PATH"
          /opt/gradle-${GRADLE_VERSION}/bin/gradle --version | grep Gradle

      - name: Accept Android SDK licenses
        run: |
          yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --licenses > /dev/null 2>&1 || true
          echo "ANDROID_HOME=$ANDROID_HOME"

      - name: Download project source
        run: |
          set -e
          curl -fsSL --retry 5 --retry-delay 3 --connect-timeout 20 "${gh('inputs.source_url')}" -o /tmp/wevlo-source.zip
          rm -rf "$GITHUB_WORKSPACE/project" && mkdir -p "$GITHUB_WORKSPACE/project"
          unzip -q -o /tmp/wevlo-source.zip -d "$GITHUB_WORKSPACE/project"
          cd "$GITHUB_WORKSPACE/project"
          shopt -s dotglob
          if [ "\$(ls -A | wc -l)" = "1" ] && [ -d "\$(ls -A)" ]; then
            mv "\$(ls -A)"/* . && rmdir "\$(ls -A)"
          fi
          echo "--- project root ---" && ls -la

      - name: Build APK (gradle assembleDebug)
        run: |
          set -o pipefail
          cd "$GITHUB_WORKSPACE/project"
          if [ -f gradlew ]; then chmod +x gradlew && ./gradlew assembleDebug --no-daemon --stacktrace; else gradle assembleDebug --no-daemon --stacktrace; fi 2>&1 | tee "$GITHUB_WORKSPACE/build.log"

      - name: Collect APK
        if: success()
        run: |
          set -e
          APK=\$(find "$GITHUB_WORKSPACE/project" -path '*outputs/apk/debug/*.apk' | head -n 1)
          if [ -z "\$APK" ]; then echo "No debug APK was produced" && exit 1; fi
          cp "\$APK" "$GITHUB_WORKSPACE/${gh('inputs.apk_name')}"
          echo "APK size: \$(stat -c%s "$GITHUB_WORKSPACE/${gh('inputs.apk_name')}") bytes"

      - name: Upload APK artifact
        if: success()
        uses: actions/upload-artifact@v4
        with:
          name: ${gh('inputs.artifact_name')}
          path: ${gh('inputs.apk_name')}
          retention-days: 7
          if-no-files-found: error

      - name: Notify website (success)
        if: success()
        run: |
          SIZE=\$(stat -c%s "$GITHUB_WORKSPACE/${gh('inputs.apk_name')}" 2>/dev/null || echo 0)
          curl -fsS --connect-timeout 15 --max-time 30 -X POST "${gh('inputs.callback_url')}" \\
            -H "Content-Type: application/json" \\
            -H "X-Build-Secret: ${gh('inputs.callback_secret')}" \\
            -d "\$(jq -n --arg s success --arg r "${gh('github.run_id')}" --arg a "${gh('inputs.artifact_name')}" --arg z "\$SIZE" '{status:\$s, run_id:\$r, artifact_name:\$a, size_bytes:(\$z|tonumber)}')" \\
            || echo "callback failed — website will pick the result up by polling"

      - name: Notify website (failure)
        if: failure()
        run: |
          TAIL=\$(tail -c 4000 "$GITHUB_WORKSPACE/build.log" 2>/dev/null || echo "build failed before log was written")
          curl -fsS --connect-timeout 15 --max-time 30 -X POST "${gh('inputs.callback_url')}" \\
            -H "Content-Type: application/json" \\
            -H "X-Build-Secret: ${gh('inputs.callback_secret')}" \\
            -d "\$(jq -n --arg s failed --arg r "${gh('github.run_id')}" --arg e "\$TAIL" '{status:\$s, run_id:\$r, error:\$e}')" \\
            || echo "callback failed — website will pick the result up by polling"
`
}
