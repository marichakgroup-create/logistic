 'use client';
import {useEffect,useRef,useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import type {GeoJSONSource,Map as LibreMap,Marker} from 'maplibre-gl';
import type {Point,TripPlan} from '@loadlink/core';
import 'maplibre-gl/dist/maplibre-gl.css';

maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
const tileUrl=process.env.NEXT_PUBLIC_MAP_TILE_URL??'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
function lines(geometry:Point[][]):GeoJSON.Feature<GeoJSON.MultiLineString>{return{type:'Feature',properties:{},geometry:{type:'MultiLineString',coordinates:geometry.filter(points=>points.length>=2).map(points=>points.map(point=>[point.lon,point.lat]))}};}

export default function RouteMap({trip,mainOrderId}:{trip:TripPlan;mainOrderId:string}){
 const container=useRef<HTMLDivElement>(null);const mapRef=useRef<LibreMap|null>(null);const markers=useRef<Marker[]>([]);
 const [unavailable,setUnavailable]=useState(false);const [backgroundUnavailable,setBackgroundUnavailable]=useState(false);
 useEffect(()=>{
  if(!container.current)return;
  let map:LibreMap;
  try{
   map=new maplibregl.Map({container:container.current,center:[13.4,52.5],zoom:5,cooperativeGestures:true,attributionControl:{compact:true},style:{version:8,sources:{basemap:{type:'raster',tiles:[tileUrl],tileSize:256,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'}},layers:[{id:'background',type:'background',paint:{'background-color':'#edf1f3'}},{id:'basemap',type:'raster',source:'basemap',paint:{'raster-saturation':-.8,'raster-opacity':.8}}]}});
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
   const routes=[{id:'main-route',geometry:trip.mainGeometry,color:'#2563eb',width:4},{id:'trip-route',geometry:trip.geometry,color:'#b77900',width:3}];
   for(const route of routes){
    const source=map.getSource(route.id) as GeoJSONSource|undefined;
    if(source)source.setData(lines(route.geometry));
    else{map.addSource(route.id,{type:'geojson',data:lines(route.geometry)});map.addLayer({id:route.id,type:'line',source:route.id,layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':route.color,'line-width':route.width}});}
   }
   markers.current.forEach(marker=>marker.remove());markers.current=[];
   const bounds=new maplibregl.LngLatBounds();
   for(const point of [...trip.geometry.flat(),...trip.stops.map(stop=>stop.point)])bounds.extend([point.lon,point.lat]);
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
 return <figure className="route-map"><div ref={container} className="route-map-canvas" role="region" aria-label="Trip route map with numbered pickup and delivery stops"/>{unavailable&&<p className="map-notice">Map unavailable. Route stops are listed below.</p>}{!unavailable&&backgroundUnavailable&&<p className="map-notice">Map background unavailable. Route stops remain visible.</p>}<figcaption><span><i className="main"/>Main route</span><span><i className="addon"/>Trip with add-ons</span>{trip.geometry.every(leg=>leg.length===0)&&<span className="map-geometry-note">Stops only · Road route unavailable</span>}</figcaption></figure>;
}
