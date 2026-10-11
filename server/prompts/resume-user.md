## Candidate's raw work data (most recent first)

{{candidateData}}

## Current resume template

Static parts of this resume are already fixed. Only produce fill-in values for the regions wrapped in `<!-- llm:... -->` markers.

{{template}}

## Fill instructions

- Experience role keys (use these EXACT keys in the `bullets` object, one entry per key): {{roleKeys}}
- Project names (use these EXACT names, in the `projects` description map and in `projectOrder`): {{projectNames}}
{{targetRoleBlock}}
{{jobDescriptionBlock}}

Produce the structured output now.
