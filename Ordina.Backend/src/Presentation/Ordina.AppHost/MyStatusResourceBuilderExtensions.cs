//using System;
//using System.Collections.Generic;
//using System.Linq;
//using System.Text;
//using System.Threading.Tasks;

//namespace Ordina.AppHost
//{
//    public static class MyStatusResourceBuilderExtensions
//    {
//        public static IResourceBuilder<MyStatusResource> AddStatusIndicator(
//            this IDistributedApplicationBuilder builder, string name)
//        {
//            var resource = new MyStatusResource(name);
//            return builder.AddResource(resource)
//                          .WithStatus("OK", StatusLevel.Ok);
//        }
//    }
//}
