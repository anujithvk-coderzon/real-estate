import MediaContents from '@/components/MediaContents';
import React from 'react';
type props={
    params:Promise<{id:string}>
}
const Page = async({params}:props) => {
    const {id}=await params
  return (
    <div>
      <MediaContents id={id}/>
    </div>
  );
}

export default Page;
