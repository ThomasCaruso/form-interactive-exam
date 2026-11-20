import { StyleSheet, Text, View } from 'react-native';
import type { Look } from '../domain/types';
import { ProductVisual } from './ProductVisual';
import { colors } from '../theme/tokens';
import { family } from '../theme/typography';
/** A consistent editorial flat lay of the exact products, not a simulated try-on. */
export function OutfitFlatLay({look}:{look:Look}) {
 const top=look.products.find(p=>p.slot==='top'),bottoms=look.products.find(p=>p.slot==='pants'),shoes=look.products.find(p=>p.slot==='shoes'),dress=look.products.find(p=>p.slot==='dress');
 if(dress)return <View style={styles.canvas}>
  <View style={styles.rule}/>
  <View style={styles.dress}><ProductVisual product={dress} transition={false}/></View>
  <View style={styles.dressShoes}>{shoes&&<ProductVisual product={shoes} gallery={1} transition={false}/>}</View>
  <Text style={[styles.note,styles.topNote]}>01 / DRESS</Text>
  <Text style={[styles.note,styles.dressShoesNote]}>02 / SHOES</Text>
  <View style={styles.palette}>{look.products.map(product=><View key={product.id} style={[styles.swatch,{backgroundColor:product.hex}]}/>)}</View>
 </View>;
 return <View style={styles.canvas}>
  <View style={styles.rule}/>
  <View style={styles.top}>{top&&<ProductVisual product={top} gallery={1} transition={false}/>}</View>
  <View style={styles.bottoms}>{bottoms&&<ProductVisual product={bottoms} fit="cover" transition={false}/>}</View>
  <View style={styles.shoes}>{shoes&&<ProductVisual product={shoes} gallery={1} transition={false}/>}</View>
  <Text style={[styles.note,styles.topNote]}>01 / TOP</Text>
  <Text style={[styles.note,styles.bottomsNote]}>02 / BOTTOMS</Text>
  <Text style={[styles.note,styles.shoesNote]}>03 / SHOES</Text>
  <View style={styles.palette}>{look.products.map(product=><View key={product.id} style={[styles.swatch,{backgroundColor:product.hex}]}/>)}</View>
 </View>;
}
const styles=StyleSheet.create({canvas:{flex:1,backgroundColor:colors.plate,overflow:'hidden'},rule:{position:'absolute',top:'11%',bottom:'13%',left:'59%',width:StyleSheet.hairlineWidth,backgroundColor:'#ECE8E1'},top:{position:'absolute',top:'7%',left:'3%',width:'54%',height:'55%',overflow:'hidden'},bottoms:{position:'absolute',top:'20%',right:'3%',width:'36%',height:'64%',overflow:'hidden'},shoes:{position:'absolute',bottom:'10%',left:'5%',width:'49%',height:'24%',overflow:'hidden'},note:{position:'absolute',fontFamily:family.sansMedium,fontSize:8,letterSpacing:1.3,color:colors.muted},topNote:{top:'5%',left:'8%'},bottomsNote:{top:'15%',left:'65%'},shoesNote:{bottom:'6%',left:'8%'},dress:{position:'absolute',top:'8%',left:'3%',width:'54%',height:'82%',overflow:'hidden'},dressShoes:{position:'absolute',bottom:'18%',right:'4%',width:'36%',height:'30%',overflow:'hidden'},dressShoesNote:{bottom:'50%',left:'65%'},palette:{position:'absolute',right:'8%',bottom:'6%',flexDirection:'row',gap:4},swatch:{width:10,height:10,borderRadius:5,borderWidth:StyleSheet.hairlineWidth,borderColor:'#BDB6AA'}});
