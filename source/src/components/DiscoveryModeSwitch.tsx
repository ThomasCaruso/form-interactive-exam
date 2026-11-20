import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { GlassSurface } from './GlassSurface';
import { MotionPressable } from './MotionPressable';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors } from '../theme/tokens';
import { family } from '../theme/typography';
export type DiscoveryMode = 'Pieces' | 'Looks';
export function DiscoveryModeSwitch({value,onChange}:{value:DiscoveryMode;onChange:(mode:DiscoveryMode)=>void}) {
 const width=useSharedValue(0), reduced=useReduceMotion();
 const thumb=useAnimatedStyle(()=>({width:Math.max(0,(width.get()-8)/2),transform:[{translateX:withTiming(value==='Pieces'?0:Math.max(0,(width.get()-8)/2),{duration:reduced?0:220})}]}));
 return <GlassSurface backing="#EDE9E1" onLayout={event=>width.set(event.nativeEvent.layout.width)} style={styles.shell}>
  <Animated.View pointerEvents="none" style={[styles.thumb,thumb]}/>
  <View accessibilityRole="tablist" style={styles.row}>{(['Pieces','Looks'] as const).map(mode=><MotionPressable glass={false} key={mode} accessibilityRole="tab" accessibilityLabel={mode==='Looks'?'Complete looks':'Pieces'} accessibilityState={{selected:value===mode}} onPress={()=>{if(mode!==value)onChange(mode);}} style={styles.tab}><Text style={[styles.label,value===mode&&styles.active]}>{mode==='Looks'?'Complete looks':'Pieces'}</Text></MotionPressable>)}</View>
 </GlassSurface>;
}
const styles=StyleSheet.create({shell:{height:46,padding:4,borderRadius:25,borderWidth:1,borderColor:colors.line2,marginBottom:14},row:{flex:1,flexDirection:'row'},thumb:{position:'absolute',left:4,top:4,bottom:4,borderRadius:21,backgroundColor:colors.ink,boxShadow:'none'},tab:{flex:1,justifyContent:'center',alignItems:'center',borderRadius:21},label:{fontFamily:family.sansMedium,fontSize:12,letterSpacing:0.2,color:colors.muted},active:{color:colors.paper}});
