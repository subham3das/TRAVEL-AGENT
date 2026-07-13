const fs = require("fs");
const path = require("path");

// ponytail: custom schema validator to avoid heavy external validator dependencies.
// Handles required fields, primitive types, array checks, and nested object fields.
function validateSchema(node, schema) {
  if (!node || typeof node !== "object") {
    return ["Node must be an object"];
  }

  const errors = [];
  const required = schema.required || [];
  const properties = schema.properties || {};

  // Check required fields
  for (const field of required) {
    if (node[field] === undefined || node[field] === null) {
      errors.push(`Missing required field: '${field}'`);
    }
  }

  // Check property types and shapes
  for (const [key, val] of Object.entries(node)) {
    const propSchema = properties[key];
    if (!propSchema) {
      if (schema.additionalProperties === false) {
        errors.push(`Extra property not allowed by schema: '${key}'`);
      }
      continue;
    }

    const type = propSchema.type;
    const actualType = typeof val;

    if (type === "array") {
      if (!Array.isArray(val)) {
        errors.push(`Field '${key}' must be an array, got ${actualType}`);
      } else if (propSchema.items && propSchema.items.type) {
        // Validate array items
        val.forEach((item, idx) => {
          if (propSchema.items.type === "object") {
            const itemErrors = validateSchema(item, propSchema.items);
            itemErrors.forEach(err => errors.push(`Field '${key}[${idx}]': ${err}`));
          } else if (typeof item !== propSchema.items.type) {
            errors.push(`Field '${key}[${idx}]' must be of type ${propSchema.items.type}, got ${typeof item}`);
          }
        });
      }
    } else if (type === "object") {
      if (actualType !== "object" || val === null || Array.isArray(val)) {
        errors.push(`Field '${key}' must be an object, got ${actualType}`);
      } else {
        // Recursively validate nested object
        const subErrors = validateSchema(val, propSchema);
        subErrors.forEach(err => errors.push(`Field '${key}.${err}'`));
      }
    } else if (type === "number") {
      if (actualType !== "number" || isNaN(val)) {
        errors.push(`Field '${key}' must be a number, got ${actualType}`);
      } else {
        if (propSchema.minimum !== undefined && val < propSchema.minimum) {
          errors.push(`Field '${key}' must be >= ${propSchema.minimum}, got ${val}`);
        }
        if (propSchema.maximum !== undefined && val > propSchema.maximum) {
          errors.push(`Field '${key}' must be <= ${propSchema.maximum}, got ${val}`);
        }
      }
    } else if (type === "boolean") {
      if (actualType !== "boolean") {
        errors.push(`Field '${key}' must be a boolean, got ${actualType}`);
      }
    } else if (type === "string") {
      if (actualType !== "string") {
        errors.push(`Field '${key}' must be a string, got ${actualType}`);
      } else if (propSchema.enum && !propSchema.enum.includes(val)) {
        errors.push(`Field '${key}' must be one of [${propSchema.enum.join(", ")}], got '${val}'`);
      }
    }
  }

  return errors;
}

// Checks referential integrity across the cached graph.
function validateReferential(cache) {
  const errors = [];
  const allNodes = cache.getAll();

  for (const node of allNodes) {
    // 1. Check destinationId points to an existing destination node
    if (node.destinationId && node.type !== "destination") {
      const dest = cache.get(node.destinationId);
      if (!dest) {
        errors.push(`Node '${node.id}' references non-existent destinationId: '${node.destinationId}'`);
      } else if (dest.type !== "destination") {
        errors.push(`Node '${node.id}' references destinationId '${node.destinationId}' but target type is '${dest.type}' instead of 'destination'`);
      }
    }

    // 2. Check edges target exists
    if (Array.isArray(node.edges)) {
      node.edges.forEach((edge, idx) => {
        const targetNode = cache.get(edge.target);
        if (!targetNode) {
          errors.push(`Node '${node.id}' edge[${idx}] references non-existent target ID: '${edge.target}'`);
        }
      });
    }

    // 3. Check plannerHints combineWith targets exist
    if (node.plannerHints && Array.isArray(node.plannerHints.combineWith)) {
      node.plannerHints.combineWith.forEach((targetId, idx) => {
        if (!cache.get(targetId)) {
          errors.push(`Node '${node.id}' plannerHints.combineWith[${idx}] references non-existent ID: '${targetId}'`);
        }
      });
    }
  }

  return errors;
}

module.exports = {
  validateSchema,
  validateReferential
};
