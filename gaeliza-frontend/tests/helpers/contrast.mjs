// WCAG 2 relative luminance/contrast, applied to the actual computed theme tokens.
function luminance(hex) {
  let value=hex.replace('#','')
  if(value.length===3)value=[...value].map(character=>character.repeat(2)).join('')
  const rgb=[0,2,4].map(offset=>Number.parseInt(value.slice(offset,offset+2),16)/255)
  const linear=rgb.map(channel=>channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4)
  return linear[0]*.2126+linear[1]*.7152+linear[2]*.0722
}
export function contrastRatio(first,second) {
  const a=luminance(first),b=luminance(second)
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)
}
