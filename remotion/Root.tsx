import type { CalculateMetadataFunction } from "remotion"
import { Composition } from "remotion"

import { Short } from "./Short.tsx"
import {
  calculateShortMetadata,
  defaultRenderProps,
  type RenderProps,
} from "./types.ts"

const calculateMetadata: CalculateMetadataFunction<RenderProps> = ({ props }) =>
  calculateShortMetadata(props)

export function RemotionRoot() {
  return (
    <Composition
      id="Short"
      component={Short}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={540}
      defaultProps={defaultRenderProps}
      calculateMetadata={calculateMetadata}
    />
  )
}
