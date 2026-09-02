# Bug Fix Plan

This plan guides you through systematic bug resolution. Please update checkboxes as you complete each step.

## Phase 1: Investigation

### [x] Bug Reproduction

- Understand the reported issue and expected behavior
- Reproduce the bug in a controlled environment
- Document steps to reproduce consistently
- Identify affected components and versions

### [x] Root Cause Analysis

- Debug and trace the issue to its source
- Identify the root cause of the problem
- Understand why the bug occurs
- Check for similar issues in related code

## Phase 2: Resolution

### [x] Fix Implementation

- Update `buildEquityActiveRows` to group by `stock_name`
- Update `buildEquityClosedRows` to group by `stock_name`
- Update `buildMfActiveRows` to group by `fund_short_name`
- Update `buildMfClosedRows` to group by `fund_short_name`
- Recalculate combined `qty`, `avgPrice`, `investedAmount`, `marketValue`, and `gain`
- Handle `xirr` for combined entries (possibly by averaging or using the group-level XIRR calculation)
- Ensure the fix doesn't introduce new issues
- Consider edge cases and boundary conditions
- Follow coding standards and best practices

### [ ] Impact Assessment

- Identify areas affected by the change
- Check for potential side effects
- Ensure backward compatibility if needed
- Document any breaking changes

## Phase 3: Verification

### [x] Testing & Verification

- Verify the bug is fixed with the original reproduction steps
- Write regression tests to prevent recurrence
- Test related functionality for side effects
- Perform integration testing if applicable

### [x] Documentation & Cleanup

- Update relevant documentation
- Add comments explaining the fix
- Clean up any debug code
- Prepare clear commit message

## Notes

- Update this plan as you discover more about the issue
- Check off completed items using [x]
- Add new steps if the bug requires additional investigation
