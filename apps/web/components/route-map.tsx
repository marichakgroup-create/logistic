 'use client';
import {useEffect,useRef,useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import type {GeoJSONSource,Map as LibreMap,Marker} from 'maplibre-gl';
import type {Point,TripPlan} from '@loadlink/core';
import 'maplibre-gl/dist/maplibre-gl.css';

maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
const tileUrl=process.env.NEXT_PUBLIC_MAP_TILE_URL??'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
function lines(geometry:Point[][]):GeoJSON.Feature<GeoJSON.MultiLineString>{return{type:'Feature',properties:{},geometry:{type:'MultiLineString',coordinates:geometry.filter(points=>points.length>=2).map(points=>points.map(point=>[point.lon,point.lat]))}};}
function stopGuide(trip:TripPlan):Point[][]{return trip.geometry.some(leg=>leg.length>=2)?[]:[trip.stops.map(stop=>stop.point)];}

export default function RouteMap({trip,mainOrderId}:{trip:TripPlan;mainOrderId:string}){
 const container=useRef<HTMLDivElement>(null);const mapRef=useRef<LibreMap|null>(null);const markers=useRef<Marker[]>([]);
 const [unavailable,setUnavailable]=useState(false);const [backgroundUnavailable,setBackgroundUnavailable]=useState(false);
 useEffect(()=>{
  if(!container.current)return;
  let map:LibreMap;
  try{
   map=new maplibregl.Map({container:container.current,center:[13.4,52.5],zoom:5,cooperativeGestures:true,attributionControl:{compact:true},style:{version:8,sources:{basemap:{type:'raster',tiles:[tileUrl],tileSize:256,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'}},layers:[{id:'background',type:'background',paint:{'background-color':'#f3f5f1'}},{id:'basemap',type:'raster',source:'basemap',paint:{'raster-saturation':-.72,'raster-contrast':-.08,'raster-opacity':.86}}]}});
  }catch{setUnavailable(true);return;}
  mapRef.current=map;
  map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
  map.on('error',event=>{if('sourceId' in event&&event.sourceId==='basemap')setBackgroundUnavailable(true);});
  const observer=new ResizeObserver(()=>map.resize());observer.observe(container.current);
  return()=>{observer.disconnect();markers.current.forEach(marker=>marker.remove());map.remove();mapRef.current=null;};
 },[]);
 useEffect(()=>{
  const map=mapRef.current;if(!map)return;
  function draw(){
   if(!map)return;
   const hasAddons=trip.orders.length>1;
   const routes=[
    {id:'main-route',geometry:trip.mainGeometry,color:'#26394a',width:5,dashed:false},
    {id:'trip-route',geometry:hasAddons?trip.geometry:[],color:'#c48600',width:5,dashed:false},
    {id:'stop-guide',geometry:stopGuide(trip),color:hasAddons?'#ad7600':'#26394a',width:3,dashed:true}
   ];
   for(const route of routes){
    const source=map.getSource(route.id) as GeoJSONSource|undefined;
    if(source)source.setData(lines(route.geometry));
    else{map.addSource(route.id,{type:'geojson',data:lines(route.geometry)});map.addLayer({id:route.id,type:'line',source:route.id,layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':route.color,'line-width':route.width,'line-opacity':route.dashed?.8:1,...(route.dashed?{'line-dasharray':[2,2]}:{})}});}
   }
   markers.current.forEach(marker=>marker.remove());markers.current=[];
   const bounds=new maplibregl.LngLatBounds();
   for(const point of [...trip.geometry.flat(),...trip.mainGeometry.flat(),...trip.stops.map(stop=>stop.point)])bounds.extend([point.lon,point.lat]);
   trip.stops.forEach((stop,index)=>{
    const order=trip.orders.find(order=>order.id===stop.orderId);const address=stop.kind==='pickup'?order?.pickupAddress:order?.deliveryAddress;
    const label=(index+1)+'. '+(stop.kind==='pickup'?'Pickup':'Delivery')+' · '+(address??'Stop');
    const button=document.createElement('button');button.type='button';button.className='route-map-stop '+(stop.orderId===mainOrderId?'main':'addon');button.textContent=String(index+1);button.setAttribute('aria-label',label);
    const content=document.createElement('div');content.className='route-map-popup';const title=document.createElement('strong');title.textContent=label;content.append(title);
    const timing=trip.timings[index];if(timing){const time=document.createElement('p');time.textContent=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(timing.arrivalAt));content.append(time);}
    markers.current.push(new maplibregl.Marker({element:button}).setLngLat([stop.point.lon,stop.point.lat]).setPopup(new maplibregl.Popup({offset:24}).setDOMContent(content)).addTo(map));
   });
   if(!bounds.isEmpty())map.fitBounds(bounds,{padding:48,maxZoom:12,duration:0});
  }
  if(map.isStyleLoaded())draw();else map.once('load',draw);
  return()=>{map.off('load',draw);};
 },[trip,mainOrderId]);
 const hasAddons=trip.orders.length>1;
 const hasRoadRoute=trip.geometry.some(leg=>leg.length>=2);
 return <figure className="route-map"><div ref={container} className="route-map-canvas" role="region" aria-label="Trip route map with numbered pickup and delivery stops"/>{unavailable&&<p className="map-notice">Map unavailable. Route stops are listed below.</p>}{!unavailable&&backgroundUnavailable&&<p className="map-notice">Map background unavailable. Route stops remain visible.</p>}<figcaption><span><i className="main"/>Main route</span>{hasAddons&&<span><i className="addon"/>Trip route · {trip.orders.length-1} add-on{trip.orders.length>2?'s':''}</span>}{!hasRoadRoute&&<span className="map-geometry-note">Dashed stop guide · Road route unavailable</span>}</figcaption></figure>;
}
