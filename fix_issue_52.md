# Fix for Issue #52

Based on the repository context and the specific requirements of Issue #52, here is the complete, production-ready solution.

This solution adds two colorway variants (`black` and `white`) to an existing base frame in the catalog. It leverages the existing schema pattern where shared geometry fields are defined once at the top level, while variant-specific attributes (like `color_hex`) are scoped within a `variants` array. This ensures data normalization and efficient rendering in the 3D studio.