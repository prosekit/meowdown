import {
  AddMarkStep,
  RemoveNodeMarkStep,
  AddNodeMarkStep,
  RemoveMarkStep,
  type Step,
} from '@prosekit/pm/transform'

import { BatchSetMarkStep } from '../extensions/batch-set-mark-step.ts'

export function isMarkStep(step: Step): boolean {
  return (
    step instanceof AddMarkStep ||
    step instanceof AddNodeMarkStep ||
    step instanceof RemoveMarkStep ||
    step instanceof RemoveNodeMarkStep ||
    step instanceof BatchSetMarkStep
  )
}
