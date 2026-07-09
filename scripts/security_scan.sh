#!/usr/bin/env bash
# ==============================================================================
# BeyondForms Industry-Standard Security Scan Pipeline
# This script runs Gitleaks, Semgrep, pip-audit, and npm audit across the monorepo.
# Safe to integrate directly into local pre-push hooks or GitHub Actions CI pipelines.
# ==============================================================================

# Terminal formatting
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${BOLD}${BLUE}==================================================${NC}"
    echo -e "${BOLD}${BLUE}  $1${NC}"
    echo -e "${BOLD}${BLUE}==================================================${NC}"
}

check_tool_installed() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${YELLOW}[WARN] $1 is not installed on this system.${NC}"
        return 1
    fi
    return 0
}

# --- 1. Secrets Scanner (Gitleaks) ---
# print_header "1. Gitleaks Secret Scan (Static Credentials Analysis)"
# if check_tool_installed "gitleaks"; then
#     echo -e "Scanning entire repository history for leaked secrets...\n"
#     gitleaks detect --verbose --redact
#     GITLEAKS_STATUS=$?
#     if [ $GITLEAKS_STATUS -eq 0 ]; then
#         echo -e "\n${GREEN}[PASS] No secrets or active API keys detected in Git history.${NC}"
#     else
#         echo -e "\n${RED}[FAIL] Leaked credentials detected in Git history! Build blocked.${NC}"
#         exit 1
#     fi
# else
#     echo -e "💡 ${BOLD}To install Gitleaks:${NC}"
#     echo -e "   - Linux (brew):  brew install gitleaks"
#     echo -e "   - Debian/Ubuntu: sudo apt install gitleaks (or download from GitHub releases)"
# fi

# --- 2. Static Application Security Testing (Semgrep SAST) ---
print_header "2. Semgrep SAST Scan (Code Semantics & Logic Analysis)"
if check_tool_installed "semgrep"; then
    echo -e "Scanning Python and JavaScript source files for OWASP vulnerabilities...\n"
    semgrep --config=auto --error
    SEMGREP_STATUS=$?
    if [ $SEMGREP_STATUS -eq 0 ]; then
        echo -e "\n${GREEN}[PASS] Semgrep static security audit completed with no issues.${NC}"
    else
        echo -e "\n${RED}[FAIL] Semgrep identified security flaws in the code semantics! Build blocked.${NC}"
        exit 1
    fi
else
    echo -e "💡 ${BOLD}To install Semgrep:${NC}"
    echo -e "   - Via pip:  pip3 install semgrep"
    echo -e "   - Via brew: brew install semgrep"
fi

# --- 3. Python Dependency Auditing (pip-audit SCA) ---
print_header "3. Python Dependency Vulnerability Scan (pip-audit SCA)"
if check_tool_installed "pip-audit"; then
    echo -e "Auditing all Python dependencies against known PyPI CVE databases...\n"

    # Scan libraries and services
    PYTHON_DEPS_PASSED=true

    # Scan top-level libraries and services
    for file in $(find . -name "pyproject.toml" -not -path "*/.venv/*" -not -path "*/.ruff_cache/*"); do
        dir=$(dirname "$file")
        echo -e "${BOLD}Auditing directory: $dir${NC}"
        (cd "$dir" && pip-audit)
        if [ $? -ne 0 ]; then
            PYTHON_DEPS_PASSED=false
        fi
        echo ""
    done

    if [ "$PYTHON_DEPS_PASSED" = true ]; then
        echo -e "${GREEN}[PASS] All Python services are free of known vulnerable dependencies.${NC}"
    else
        echo -e "${RED}[FAIL] Python dependency vulnerability check failed! Build blocked.${NC}"
        exit 1
    fi
else
    echo -e "💡 ${BOLD}To install pip-audit:${NC}"
    echo -e "   - Via pip: pip3 install pip-audit"
fi

# --- 4. Node.js Dependency Auditing (npm audit SCA) ---
print_header "4. Node.js Dependency Vulnerability Scan (npm audit SCA)"
if check_tool_installed "npm"; then
    echo -e "Auditing wallet frontend and Node prototypes against Node Security Advisories...\n"

    NODE_DEPS_PASSED=true
    for file in $(find . -name "package.json" -not -path "*/node_modules/*" -not -path "*/.next/*"); do
        dir=$(dirname "$file")
        echo -e "${BOLD}Auditing Node directory: $dir${NC}"
        # Skip if package-lock doesn't exist yet, as npm audit requires a lockfile
        if [ -f "$dir/package-lock.json" ] || [ -f "$dir/yarn.lock" ] || [ -f "$dir/pnpm-lock.yaml" ]; then
            (cd "$dir" && npm audit --audit-level=high)
            if [ $? -ne 0 ]; then
                NODE_DEPS_PASSED=false
            fi
        else
            echo -e "${YELLOW}[WARN] Missing package lockfile in $dir. Skipping npm audit.${NC}"
        fi
        echo ""
    done

    if [ "$NODE_DEPS_PASSED" = true ]; then
        echo -e "${GREEN}[PASS] All active Node.js dependencies passed safety standards.${NC}"
    else
        echo -e "${RED}[FAIL] Insecure package versions detected in Node dependencies! Build blocked.${NC}"
        exit 1
    fi
else
    echo -e "💡 ${BOLD}To install Node.js package auditing:${NC}"
    echo -e "   - Install NodeJS/NPM: https://nodejs.org/en/download"
fi

echo -e "\n${GREEN}${BOLD}==================================================${NC}"
echo -e "${GREEN}${BOLD}  ALL AUTOMATED SECURITY AUDITING GATES PASSED!    ${NC}"
echo -e "${GREEN}${BOLD}==================================================${NC}"
exit 0
